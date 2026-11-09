import test from "node:test";
import assert from "node:assert/strict";
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
    if (!handlers[host]) throw new Error("Unexpected provider request: " + host);
    return handlers[host]();
  };
  return calls;
}
const ok = (content) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const geminiOk = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

// Minimal in-memory D1 stand-in for the shared per-provider daily call counter.
function fakeDb() {
  const counts = new Map();
  const prepare = (sql) => ({
    args: [],
    bind(...args) { this.args = args; return this; },
    async run() { return {}; },
    async first() {
      if (/INSERT INTO ai_provider_daily_budget/.test(sql)) {
        const [day, provider, limit] = this.args;
        const key = day + "|" + provider;
        const used = counts.get(key) || 0;
        if (used >= limit) return null;
        counts.set(key, used + 1);
        return { calls: used + 1 };
      }
      return null;
    }
  });
  return { prepare, counts };
}
const baseEnv = (extra = {}) => ({ APP_SHARED_TOKEN: TOKEN, APPROVAL_DB: fakeDb(), ...extra });

test.afterEach(() => { globalThis.fetch = realFetch; });

test("falls back from rate-limited Gemini to Groq", async () => {
  const calls = mockFetch({
    "generativelanguage.googleapis.com": () => new Response("{}", { status: 429 }),
    "api.groq.com": () => ok("jawaban groq")
  });
  const res = await (await load()).fetch(req("/api/agents/chat", { ...chat, agentId: "olivia" }), baseEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.provider, "groq");
  assert.equal(data.reply, "jawaban groq");
  assert.deepEqual(calls, ["generativelanguage.googleapis.com", "api.groq.com"]);
});

test("uses Gemini first when healthy", async () => {
  mockFetch({ "generativelanguage.googleapis.com": () => geminiOk("dari gemini") });
  const res = await (await load()).fetch(req("/api/agents/chat", { ...chat, agentId: "olivia" }), baseEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" }));
  assert.equal((await res.json()).provider, "gemini");
});

test("returns 503 when no free provider is configured", async () => {
  const res = await (await load()).fetch(req("/api/agents/chat", chat), { APP_SHARED_TOKEN: TOKEN, APPROVAL_DB: fakeDb() });
  assert.equal(res.status, 503);
});

test("returns safe provider diagnostics when every configured free provider fails", async () => {
  mockFetch({ "api.groq.com": () => new Response(JSON.stringify({ error: { message: "model unavailable" } }), { status: 500 }) });
  const privateKey = "never-expose-this-groq-key";
  const res = await (await load()).fetch(req("/api/agents/chat", chat), baseEnv({ GROQ_API_KEY: privateKey }));
  const data = await res.json();
  assert.equal(res.status, 502);
  assert.equal(data.ok, false);
  assert.equal(data.diagnostics[0].provider, "groq");
  assert.equal(data.diagnostics[0].model, "llama-3.3-70b-versatile");
  assert.equal(data.diagnostics[0].status, 500);
  assert.equal(data.diagnostics[0].reason, "model unavailable");
  assert.ok(!JSON.stringify(data).includes(privateKey));
});

test("health exposes only the free allowlist and never exposes secrets", async () => {
  const env = { APP_SHARED_TOKEN: TOKEN, GEMINI_API_KEY: "g", GROQ_API_KEY: "q",
    CLAUDE_API_KEY: "legacy-secret", OPENAI_API_KEY: "legacy-secret", PAID_AI_ENABLED: "true" };
  const res = await (await load()).fetch(new Request("https://w.example/health"), env);
  const body = await res.text();
  assert.ok(!body.includes("legacy-secret"));
  const data = JSON.parse(body);
  assert.deepEqual(data.llmProvidersConfigured, ["gemini", "groq"]);
  assert.deepEqual(data.llmProvidersAvailable, ["gemini", "groq", "cerebras", "openrouter", "workers-ai"]);
  assert.equal(data.llmMode, "free-only-fallback-chain");
  assert.equal("paidAiEnabled" in data, false);
  assert.equal("limitedProviders" in data, false);
  assert.equal("dailyTokenLimits" in data, false);
});

test("legacy paid-provider secrets and switches are ignored; Gemini is called instead", async () => {
  const calls = mockFetch({ "generativelanguage.googleapis.com": () => geminiOk("free provider") });
  const env = baseEnv({ GEMINI_API_KEY: "g", CLAUDE_API_KEY: "legacy", OPENAI_API_KEY: "legacy", PAID_AI_ENABLED: "true" });
  const data = await (await (await load()).fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(data.provider, "gemini");
  assert.deepEqual(calls, ["generativelanguage.googleapis.com"]);
});

test("AI requests fail closed when D1 budget storage is unavailable", async () => {
  const calls = mockFetch({ "generativelanguage.googleapis.com": () => geminiOk("must not be called") });
  const env = { APP_SHARED_TOKEN: TOKEN, GEMINI_API_KEY: "g" };
  const res = await (await load()).fetch(req("/api/agents/chat", chat), env);
  const data = await res.json();
  assert.equal(res.status, 429);
  assert.equal(calls.length, 0);
  assert.equal(data.diagnostics[0].outcome, "daily_limit");
});

test("provider daily cap sends the next request to the next free provider", async () => {
  const calls = mockFetch({
    "generativelanguage.googleapis.com": () => geminiOk("gemini"),
    "api.groq.com": () => ok("groq")
  });
  const env = baseEnv({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q", GEMINI_DAILY_LIMIT: "1" });
  const worker = await load();
  const first = await (await worker.fetch(req("/api/agents/chat", chat), env)).json();
  const second = await (await worker.fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(first.provider, "gemini");
  assert.equal(second.provider, "groq");
  assert.deepEqual(calls, ["generativelanguage.googleapis.com", "api.groq.com"]);
});

test("rejects requests without a valid shared token", async () => {
  const request = new Request("https://w.example/api/agents/chat", {
    method: "POST", headers: { Origin: "https://dickv940-star.github.io", Authorization: "Bearer wrong" }, body: "{}"
  });
  const res = await (await load()).fetch(request, { APP_SHARED_TOKEN: TOKEN, GROQ_API_KEY: "q", APPROVAL_DB: fakeDb() });
  assert.equal(res.status, 401);
});
