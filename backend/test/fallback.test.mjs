import test from "node:test";
import assert from "node:assert/strict";
// Fresh module per test so per-isolate provider cooldowns do not leak between tests.
const load = async () => (await import("../worker.js?t=" + Math.random())).default;

const realFetch = globalThis.fetch;
const TOKEN = "t".repeat(24);

function req(path, body, method = "POST") {
  return new Request("https://w.example" + path, {
    method,
    headers: { Origin: "https://dickv940-star.github.io", Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}
const chat = { agentId: "alexander", messages: [{ role: "user", content: "halo" }] };

function mockFetch(handlers) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).host;
    calls.push(host);
    return handlers[host]();
  };
  return calls;
}
const ok = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const geminiOk = (t) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }), { status: 200 });

test.afterEach(() => { globalThis.fetch = realFetch; });

test("falls back from rate-limited Gemini to Groq", async () => {
  const calls = mockFetch({
    "generativelanguage.googleapis.com": () => new Response("{}", { status: 429 }),
    "api.groq.com": () => ok("jawaban groq")
  });
  const env = { APP_SHARED_TOKEN: TOKEN, GEMINI_API_KEY: "g", GROQ_API_KEY: "q" };
  const res = await (await load()).fetch(req("/api/agents/chat", { ...chat, agentId: "olivia" }), env);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.provider, "groq");
  assert.equal(data.reply, "jawaban groq");
  assert.deepEqual(calls, ["generativelanguage.googleapis.com", "api.groq.com"]);
});

test("uses first provider when healthy", async () => {
  mockFetch({ "generativelanguage.googleapis.com": () => geminiOk("dari gemini") });
  const env = { APP_SHARED_TOKEN: TOKEN, GEMINI_API_KEY: "g", GROQ_API_KEY: "q" };
  const res = await (await load()).fetch(req("/api/agents/chat", { ...chat, agentId: "olivia" }), env);
  assert.equal((await res.json()).provider, "gemini");
});

test("returns 503 when no provider is configured", async () => {
  const res = await (await load()).fetch(req("/api/agents/chat", chat), { APP_SHARED_TOKEN: TOKEN });
  assert.equal(res.status, 503);
});

test("returns 502 when every provider fails", async () => {
  mockFetch({ "api.groq.com": () => new Response("{}", { status: 500 }) });
  const res = await (await load()).fetch(req("/api/agents/chat", chat), { APP_SHARED_TOKEN: TOKEN, GROQ_API_KEY: "q" });
  assert.equal(res.status, 502);
});

test("health lists configured providers and never exposes keys", async () => {
  const env = { APP_SHARED_TOKEN: TOKEN, GROQ_API_KEY: "secret-value" };
  const res = await (await load()).fetch(new Request("https://w.example/health"), env);
  const text = await res.text();
  assert.ok(!text.includes("secret-value"));
  const data = JSON.parse(text);
  assert.deepEqual(data.llmProvidersConfigured, ["groq"]);
  assert.equal(data.paidProvidersDisabled, true);
});

test("rejects requests without a valid token", async () => {
  const r = new Request("https://w.example/api/agents/chat", {
    method: "POST", headers: { Origin: "https://dickv940-star.github.io", Authorization: "Bearer wrong" }, body: "{}"
  });
  const res = await (await load()).fetch(r, { APP_SHARED_TOKEN: TOKEN, GROQ_API_KEY: "q" });
  assert.equal(res.status, 401);
});


test("persistent task history requires D1 storage", async () => {
  const res = await (await load()).fetch(req("/api/tasks", undefined, "GET"), { APP_SHARED_TOKEN: TOKEN });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "Penyimpanan tugas belum dikonfigurasi.");
});

test("persistent task history endpoint returns a safe empty list", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async run() { return { success: true }; },
        async all() { return { results: [] }; },
        async first() { return null; }
      };
    }
  };
  const res = await (await load()).fetch(req("/api/tasks", undefined, "GET"), { APP_SHARED_TOKEN: TOKEN, APPROVAL_DB: db });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(data.items, []);
});


test("memory API rejects credentials and passwords", async () => {
  const res = await (await load()).fetch(req("/api/memory", {
    key: "project-secret",
    category: "project",
    title: "Credential",
    content: "api_key: example-secret-value"
  }), { APP_SHARED_TOKEN: TOKEN, APPROVAL_DB: { prepare() { throw new Error("should not reach database"); } } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Jangan simpan kredensial/);
});

test("memory API validates input before saving", async () => {
  const res = await (await load()).fetch(req("/api/memory", {
    key: "bad key",
    category: "project",
    title: "Title",
    content: "Text"
  }), { APP_SHARED_TOKEN: TOKEN });
  assert.equal(res.status, 400);
});

test("memory API reports unavailable D1 store clearly", async () => {
  const res = await (await load()).fetch(req("/api/memory", undefined, "GET"), { APP_SHARED_TOKEN: TOKEN });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "Penyimpanan memori belum dikonfigurasi.");
});
