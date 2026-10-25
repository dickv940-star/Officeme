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
  assert.deepEqual(data.limitedProviders, ["claude", "openai"]);
  assert.equal(data.dailyLimits.claude, 500);
  assert.equal(data.dailyLimits.openai, 500);
  assert.equal(data.llmMode, "limited-then-free-fallback-chain");
});

// Minimal in-memory stand-in for the D1 statements used by the budget guards.
function fakeDb() {
  const calls = new Map();   // "day|provider" -> calls
  const usage = new Map();   // "day|provider" -> { tokens, disabled }
  const stmt = (sql) => ({
    args: [],
    bind(...a) { this.args = a; return this; },
    async run() {
      if (/INSERT INTO ai_paid_usage/.test(sql)) {
        const [day, provider, tokens, disabled] = this.args;
        const k = day + "|" + provider;
        const cur = usage.get(k) || { tokens: 0, disabled: 0 };
        usage.set(k, { tokens: cur.tokens + tokens, disabled: Math.max(cur.disabled, disabled) });
      }
      return {};
    },
    async first() {
      if (/INSERT INTO ai_provider_daily_budget/.test(sql)) {
        const [day, provider, limit] = this.args;
        const k = day + "|" + provider;
        const n = calls.get(k) || 0;
        if (n >= limit) return null;
        calls.set(k, n + 1);
        return { calls: n + 1 };
      }
      if (/FROM ai_paid_usage/.test(sql)) return usage.get(this.args[0] + "|" + this.args[1]) || null;
      return null;
    }
  });
  return { prepare: stmt, calls, usage };
}
const claudeOk = (t) => new Response(JSON.stringify({ content: [{ type: "text", text: t }], usage: { input_tokens: 10, output_tokens: 20 } }), { status: 200 });

test("Claude answers first, then OpenAI, then free providers", async () => {
  const calls = mockFetch({
    "api.anthropic.com": () => claudeOk("dari claude"),
  });
  const db = fakeDb();
  const env = { APP_SHARED_TOKEN: TOKEN, CLAUDE_API_KEY: "c", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", APPROVAL_DB: db };
  const res = await (await load()).fetch(req("/api/agents/chat", chat), env);
  const data = await res.json();
  assert.equal(data.provider, "claude");
  assert.deepEqual(calls, ["api.anthropic.com"]);
  assert.equal([...db.usage.values()][0].tokens, 30);
});

test("falls to OpenAI when Claude daily call limit is reached, then to Gemini", async () => {
  const calls = mockFetch({
    "api.anthropic.com": () => claudeOk("tidak boleh dipanggil"),
    "api.openai.com": () => new Response(JSON.stringify({ choices: [{ message: { content: "dari openai" } }], usage: { total_tokens: 5 } }), { status: 200 }),
    "generativelanguage.googleapis.com": () => geminiOk("dari gemini")
  });
  const db = fakeDb();
  const day = new Date().toISOString().slice(0, 10);
  db.calls.set(day + "|claude", 2);
  const env = { APP_SHARED_TOKEN: TOKEN, CLAUDE_API_KEY: "c", OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", CLAUDE_DAILY_LIMIT: "2", OPENAI_DAILY_LIMIT: "1", APPROVAL_DB: db };
  const w = await load();
  const first = await (await w.fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(first.provider, "openai");
  const second = await (await w.fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(second.provider, "gemini");
  assert.ok(!calls.includes("api.anthropic.com"));
});

test("billing/auth error disables the paid provider for the day and falls back", async () => {
  const calls = mockFetch({
    "api.anthropic.com": () => new Response(JSON.stringify({ error: { message: "Your credit balance is too low" } }), { status: 400 }),
    "generativelanguage.googleapis.com": () => geminiOk("dari gemini")
  });
  const db = fakeDb();
  const env = { APP_SHARED_TOKEN: TOKEN, CLAUDE_API_KEY: "c", GEMINI_API_KEY: "g", APPROVAL_DB: db };
  const w = await load();
  assert.equal((await (await w.fetch(req("/api/agents/chat", chat), env)).json()).provider, "gemini");
  assert.equal([...db.usage.values()][0].disabled, 1);
  calls.length = 0;
  assert.equal((await (await w.fetch(req("/api/agents/chat", chat), env)).json()).provider, "gemini");
  assert.ok(!calls.includes("api.anthropic.com"), "disabled provider must not be called again today");
});

test("daily token cap stops paid provider", async () => {
  const calls = mockFetch({
    "api.anthropic.com": () => claudeOk("x"),
    "generativelanguage.googleapis.com": () => geminiOk("dari gemini")
  });
  const db = fakeDb();
  const day = new Date().toISOString().slice(0, 10);
  db.usage.set(day + "|claude", { tokens: 1000, disabled: 0 });
  const env = { APP_SHARED_TOKEN: TOKEN, CLAUDE_API_KEY: "c", GEMINI_API_KEY: "g", CLAUDE_DAILY_TOKEN_LIMIT: "1000", APPROVAL_DB: db };
  const data = await (await (await load()).fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(data.provider, "gemini");
  assert.ok(!calls.includes("api.anthropic.com"));
});

test("paid providers are never called without a working D1 counter (fail-closed)", async () => {
  const calls = mockFetch({
    "api.anthropic.com": () => claudeOk("x"),
    "generativelanguage.googleapis.com": () => geminiOk("dari gemini")
  });
  const env = { APP_SHARED_TOKEN: TOKEN, CLAUDE_API_KEY: "c", GEMINI_API_KEY: "g" };
  const data = await (await (await load()).fetch(req("/api/agents/chat", chat), env)).json();
  assert.equal(data.provider, "gemini");
  assert.ok(!calls.includes("api.anthropic.com"));
});

test("rejects requests without a valid token", async () => {
  const r = new Request("https://w.example/api/agents/chat", {
    method: "POST", headers: { Origin: "https://dickv940-star.github.io", Authorization: "Bearer wrong" }, body: "{}"
  });
  const res = await (await load()).fetch(r, { APP_SHARED_TOKEN: TOKEN, GROQ_API_KEY: "q" });
  assert.equal(res.status, 401);
});
