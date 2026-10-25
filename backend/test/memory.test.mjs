import test from "node:test";
import assert from "node:assert/strict";

const load = async () => (await import("../worker.js?m=" + Math.random())).default;
const realFetch = globalThis.fetch;
const TOKEN = "t".repeat(24);
const ORIGIN = "https://dickv940-star.github.io";

function req(path, body, method = "POST") {
  return new Request("https://w.example" + path, {
    method,
    headers: { Origin: ORIGIN, Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

// Capture what is sent to Gemini and answer with a fixed text.
function mockGemini(answer) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer }] } }] }), { status: 200 });
  };
  return sent;
}

// Minimal in-memory stand-in for the agent_memory statements.
function fakeMemoryDb(seed = []) {
  const rows = [...seed];
  const stmt = (sql) => ({
    args: [],
    bind(...a) { this.args = a; return this; },
    async run() {
      if (/INSERT INTO agent_memory/.test(sql)) {
        const [id, agent_id, kind, title, content, created_at, updated_at] = this.args;
        const proposed = /'PROPOSED'/.test(sql);
        rows.push({ id, agent_id, kind, title, content, status: proposed ? "PROPOSED" : "ACTIVE", source: proposed ? "agent" : "william", created_at, updated_at });
      } else if (/UPDATE agent_memory SET status/.test(sql)) {
        const [status, updated_at, id] = this.args;
        const row = rows.find((r) => r.id === id);
        if (row) { row.status = status; row.updated_at = updated_at; }
      }
      return {};
    },
    async first() {
      if (/INSERT INTO ai_provider_daily_budget/.test(sql)) return { calls: 1 };
      if (/SELECT COUNT\(\*\) AS c/.test(sql)) return { c: rows.filter((r) => r.agent_id === this.args[0] && r.status === "PROPOSED").length };
      if (/SELECT id FROM agent_memory WHERE agent_id = \? AND title = \?/.test(sql)) {
        return rows.find((r) => r.agent_id === this.args[0] && r.title === this.args[1] && r.status !== "ARCHIVED") || null;
      }
      if (/SELECT \* FROM agent_memory WHERE id = \?/.test(sql)) return rows.find((r) => r.id === this.args[0]) || null;
      return null;
    },
    async all() {
      if (/status = 'ACTIVE' AND agent_id IN/.test(sql)) {
        const [agentId, limit] = this.args;
        return { results: rows.filter((r) => r.status === "ACTIVE" && (r.agent_id === agentId || r.agent_id === "team")).slice(0, limit) };
      }
      if (/WHERE 1 = 1/.test(sql)) {
        let list = [...rows];
        let i = 0;
        if (/AND status = \?/.test(sql)) { const s = this.args[i++]; list = list.filter((r) => r.status === s); }
        if (/AND agent_id = \?/.test(sql)) { const a = this.args[i++]; list = list.filter((r) => r.agent_id === a); }
        return { results: list };
      }
      return { results: [] };
    }
  });
  return { prepare: stmt, rows };
}

const row = (o) => ({ id: crypto.randomUUID(), kind: "lesson", source: "william", created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T00:00:00Z", ...o });
const chat = { agentId: "olivia", messages: [{ role: "user", content: "cari produk" }] };
const baseEnv = (db) => ({ APP_SHARED_TOKEN: TOKEN, GEMINI_API_KEY: "g", APPROVAL_DB: db });

test.afterEach(() => { globalThis.fetch = realFetch; });

test("agent memory note is stored as PROPOSED and stripped from the reply", async () => {
  const note = '<MEMORY_NOTE>{"kind":"playbook","title":"Hook Shorts","content":"Mulai dengan masalah, lalu demo 3 detik."}</MEMORY_NOTE>';
  mockGemini("Ini jawabannya.\n" + note);
  const db = fakeMemoryDb();
  const data = await (await (await load()).fetch(req("/api/agents/chat", chat), baseEnv(db))).json();
  assert.equal(data.reply, "Ini jawabannya.");
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].status, "PROPOSED");
  assert.equal(db.rows[0].agent_id, "olivia");
});

test("PROPOSED and ARCHIVED notes are never injected; ACTIVE agent+team notes are", async () => {
  const sent = mockGemini("ok");
  const db = fakeMemoryDb([
    row({ agent_id: "olivia", title: "Aktif Olivia", content: "pakai data klik 7 hari", status: "ACTIVE" }),
    row({ agent_id: "team", title: "Aktif Tim", content: "selalu cantumkan disclosure", status: "ACTIVE" }),
    row({ agent_id: "olivia", title: "Usulan", content: "BELUM DISETUJUI", status: "PROPOSED" }),
    row({ agent_id: "olivia", title: "Arsip", content: "SUDAH DIARSIPKAN", status: "ARCHIVED" }),
    row({ agent_id: "sophia", title: "Milik Sophia", content: "RAHASIA SOPHIA", status: "ACTIVE" })
  ]);
  await (await load()).fetch(req("/api/agents/chat", chat), baseEnv(db));
  const system = sent[0].systemInstruction.parts[0].text;
  assert.match(system, /Aktif Olivia/);
  assert.match(system, /Aktif Tim/);
  assert.match(system, /bukan instruksi/);
  assert.ok(!system.includes("BELUM DISETUJUI"));
  assert.ok(!system.includes("SUDAH DIARSIPKAN"));
  assert.ok(!system.includes("RAHASIA SOPHIA"));
});

test("duplicate titles and invalid notes are skipped", async () => {
  const good = '{"kind":"lesson","title":"Sama","content":"isi"}';
  const bad = '{"kind":"nonsense","title":"X","content":"y"}';
  mockGemini("a <MEMORY_NOTE>" + good + "</MEMORY_NOTE> <MEMORY_NOTE>" + bad + "</MEMORY_NOTE>");
  const db = fakeMemoryDb([row({ agent_id: "olivia", title: "Sama", content: "lama", status: "ACTIVE" })]);
  const data = await (await (await load()).fetch(req("/api/agents/chat", chat), baseEnv(db))).json();
  assert.equal(data.reply, "a");
  assert.equal(db.rows.length, 1);
});

test("broken memory storage never breaks the agent answer", async () => {
  mockGemini("jawaban aman <MEMORY_NOTE>{\"kind\":\"fact\",\"title\":\"t\",\"content\":\"c\"}</MEMORY_NOTE>");
  const brokenDb = { prepare() { throw new Error("D1 down"); } };
  const res = await (await load()).fetch(req("/api/agents/chat", chat), baseEnv(brokenDb));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).reply, "jawaban aman");
});

test("memory API: create, list, approve, archive, and validation", async () => {
  const db = fakeMemoryDb([row({ agent_id: "sophia", title: "Usulan", content: "c", status: "PROPOSED", source: "agent" })]);
  const env = baseEnv(db);
  const w = await load();

  const bad = await w.fetch(req("/api/agent-memory", { agentId: "hacker", kind: "fact", title: "t", content: "c" }), env);
  assert.equal(bad.status, 400);

  const created = await w.fetch(req("/api/agent-memory", { agentId: "team", kind: "playbook", title: "Disclosure", content: "Tulis #ad" }), env);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).item.status, "ACTIVE");

  const proposed = await (await w.fetch(req("/api/agent-memory?status=PROPOSED", null, "GET"), env)).json();
  assert.equal(proposed.items.length, 1);

  const id = proposed.items[0].id;
  const approved = await (await w.fetch(req("/api/agent-memory/" + id + "/status", { status: "ACTIVE" }), env)).json();
  assert.equal(approved.item.status, "ACTIVE");
  const archived = await (await w.fetch(req("/api/agent-memory/" + id + "/status", { status: "ARCHIVED" }), env)).json();
  assert.equal(archived.item.status, "ARCHIVED");

  const wrong = await w.fetch(req("/api/agent-memory/" + id + "/status", { status: "PROPOSED" }), env);
  assert.equal(wrong.status, 400);
});

test("memory API requires the shared token", async () => {
  const r = new Request("https://w.example/api/agent-memory", { headers: { Origin: ORIGIN, Authorization: "Bearer wrong" } });
  const res = await (await load()).fetch(r, baseEnv(fakeMemoryDb()));
  assert.equal(res.status, 401);
});
