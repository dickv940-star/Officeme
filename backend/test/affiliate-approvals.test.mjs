import test from "node:test";
import assert from "node:assert/strict";

const TOKEN = "owner-token-for-tests-123456789";
const SHARED = "shared-token-for-tests-123456";
const ORIGIN = "https://dickv940-star.github.io";

function request(path, body, method = "POST", token = TOKEN) {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      Origin: ORIGIN,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function fakeApprovalDb() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) { this.args = args; return this; },
        async run() {
          if (/INSERT INTO affiliate_content_versions/.test(sql)) {
            const [content_id, version, payload_json, fingerprint, created_at] = this.args;
            if (rows.some(r => r.content_id === content_id && r.version === version)) throw new Error("duplicate version");
            rows.push({ content_id, version, payload_json, fingerprint, status: "PENDING_OWNER_APPROVAL", decision_note: null, created_at, decided_at: null });
            return { meta: { changes: 1 } };
          }
          if (/UPDATE affiliate_content_versions SET status/.test(sql)) {
            const [status, decision_note, decided_at, content_id, version] = this.args;
            const row = rows.find(r => r.content_id === content_id && r.version === version && r.status === "PENDING_OWNER_APPROVAL");
            if (!row) return { meta: { changes: 0 } };
            Object.assign(row, { status, decision_note, decided_at });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        async first() {
          if (/SELECT COALESCE\(MAX\(version\),0\) AS version FROM affiliate_content_versions/.test(sql)) {
            const versions = rows.filter(r => r.content_id === this.args[0]).map(r => r.version);
            return { version: versions.length ? Math.max(...versions) : 0 };
          }
          return null;
        },
        async all() {
          if (/FROM affiliate_content_versions ORDER BY created_at DESC/.test(sql)) {
            return { results: [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)) };
          }
          return { results: [] };
        }
      };
      return statement;
    }
  };
}

const content = {
  id: "draft_test_01",
  accountId: "account_01",
  platform: "youtube",
  productName: "Lampu LED",
  link: "https://shopee.co.id/product-test",
  caption: "Naskah konten yang perlu ditinjau pemilik.",
  audience: "Pengguna rumah",
  goal: "Klik berkualitas",
  format: "Video pendek",
  facts: "Fakta produk dari pemilik",
  research: "",
  aiSource: "manual",
  createdAt: "2026-11-09T08:00:00.000Z"
};

function env(db) {
  return { APP_SHARED_TOKEN: SHARED, APP_OWNER_TOKEN: TOKEN, APPROVAL_DB: db };
}

test("affiliate content approval creates an immutable pending version and lists it", async () => {
  const worker = (await import("../worker.js?affiliate-approval=" + Math.random())).default;
  const db = fakeApprovalDb();
  const created = await worker.fetch(request("/api/owner/content-approvals", { content }), env(db));
  assert.equal(created.status, 201);
  const item = await created.json();
  assert.equal(item.status, "PENDING_OWNER_APPROVAL");
  assert.equal(item.version, 1);
  assert.ok(item.fingerprint);

  const listed = await worker.fetch(request("/api/owner/content-approvals", undefined, "GET"), env(db));
  assert.equal(listed.status, 200);
  const data = await listed.json();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].payload.caption, content.caption);
  assert.equal(data.items[0].status, "PENDING_OWNER_APPROVAL");
});

test("affiliate content approval decision is owner-only and cannot be repeated", async () => {
  const worker = (await import("../worker.js?affiliate-decision=" + Math.random())).default;
  const db = fakeApprovalDb();
  await worker.fetch(request("/api/owner/content-approvals", { content }), env(db));

  const approved = await worker.fetch(request("/api/owner/content-approvals/draft_test_01/decision", {
    version: 1, decision: "approve"
  }), env(db));
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).status, "APPROVED");

  const repeated = await worker.fetch(request("/api/owner/content-approvals/draft_test_01/decision", {
    version: 1, decision: "reject"
  }), env(db));
  assert.equal(repeated.status, 409);
  assert.equal(db.rows[0].status, "APPROVED");
});

test("affiliate content approval rejects missing owner token and invalid content", async () => {
  const worker = (await import("../worker.js?affiliate-validation=" + Math.random())).default;
  const db = fakeApprovalDb();

  const unauthorized = await worker.fetch(
    request("/api/owner/content-approvals", { content }, "POST", "wrong-token"),
    env(db)
  );
  assert.equal(unauthorized.status, 401);

  const invalid = await worker.fetch(
    request("/api/owner/content-approvals", { content: { ...content, link: "javascript:alert(1)" } }),
    env(db)
  );
  assert.equal(invalid.status, 400);
});
