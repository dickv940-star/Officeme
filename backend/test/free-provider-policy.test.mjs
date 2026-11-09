import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("paid AI vendors and billing switches are absent from the Worker", () => {
  for (const forbidden of [
    "CLAUDE_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "api.anthropic.com",
    "api.openai.com",
    "PAID_AI_ENABLED",
    "LIMITED_PROVIDER_ORDER",
    "callClaude",
    "callOpenAILimited"
  ]) {
    assert.equal(worker.includes(forbidden), false, `unexpected paid-provider reference: ${forbidden}`);
  }
});

test("only the approved free-tier provider adapters are configured", () => {
  const start = worker.indexOf("const FREE_PROVIDERS = {");
  const end = worker.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, "provider allowlist must exist");
  const config = worker.slice(start, end);
  const providers = [...config.matchAll(/^  (?:"([^"]+)"|([a-z-]+)): \{/gm)]
    .map(match => match[1] || match[2]);
  assert.deepEqual(providers, ["gemini", "groq", "cerebras", "openrouter", "workers-ai"]);
});

test("AI calls fail closed when the D1 budget counter is unavailable", () => {
  assert.match(worker, /const failClosed = true;/);
  assert.match(worker, /if \(!db \|\| typeof db\.prepare !== "function"\) return !failClosed;/);
  assert.match(worker, /llmMode: "free-only-fallback-chain"/);
});

test("default free-tier request caps are conservative", () => {
  for (const [provider, limit] of [
    ["gemini", 30],
    ["groq", 30],
    ["cerebras", 30],
    ["openrouter", 20],
    ["workers-ai", 40]
  ]) {
    const escaped = provider === "workers-ai" ? '"workers-ai"' : provider;
    const pattern = new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]{0,240}?daily: " + limit);
    assert.match(worker, pattern, `${provider} daily cap should default to ${limit}`);
  }
});
