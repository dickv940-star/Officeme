import test from "node:test";
import assert from "node:assert/strict";

const load = async () => (await import("../worker.js?approval=" + Math.random())).default;
const SHARED = "s".repeat(32);
const OWNER = "o".repeat(32);
const ORIGIN = "https://dickv940-star.github.io";

function request(path, body, token = SHARED, method = "POST") {
  return new Request("https://worker.example" + path, {
    method,
    headers: {
      Origin: ORIGIN,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

function fakeApprovalDb() {
  const rows = [];
  const prepare = (sql) => ({
    args: [],
    bind(...args) { this.args = args; return this; },
    async first() {
      if (/SELECT COALESCE\(MAX\(version\), 0\) AS version FROM approval_packages/.test(sql)) {
        const contentId = this.args[0];
        return { version: Math.max(0, ...rows.filter(r => r.content_id === contentId).map(r => r.version)) };
      }
      if (/SELECT status FROM approval_packages WHERE content_id = \? AND version = \?/.test(sql)) {
        const [id, version] = this.args;
        const row = rows.find(r => r.content_id === id && r.version === version);
        return row ? { status: row.status } : null;
      }
      if (/SELECT payload_json, fingerprint, status FROM approval_packages/.test(sql)) {
        const [id, version] = this.args;
        return rows.find(r => r.content_id === id && r.version === version) || null;
      }
      return null;
    },
    async run() {
      if (/INSERT INTO approval_packages/.test(sql)) {
        const [content_id, version, payload_json, fingerprint, created_at] = this.args;
        rows.push({
          content_id, version, payload_json, fingerprint,
          status: "PENDING_OWNER_APPROVAL",
          decision_note: null,
          created_at,
          decided_at: null
        });
        return { meta: { changes: 1 } };
      }
      if (/UPDATE approval_packages SET status =/.test(sql)) {
        const [status, decision_note, decided_at, content_id, version] = this.args;
        const row = rows.find(r => r.content_id === content_id && r.version === version && r.status === "PENDING_OWNER_APPROVAL");
        if (!row) return { meta: { changes: 0 } };
        Object.assign(row, { status, decision_note, decided_at });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
    async all() {
      if (/SELECT content_id, version, payload_json, fingerprint, status, decision_note, created_at, decided_at FROM approval_packages/.test(sql)) {
        return { results: [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)) };
      }
      return { results: [] };
    }
  });
  return { prepare, rows };
}

const payload = () => ({
  contentId: "shopee_campaign_01",
  productName: "Produk Uji",
  affiliateLink: "https://s.shopee.co.id/example",
  videoUrl: "https://cdn.example.test/review.mp4",
  caption: "Draf promosi untuk ditinjau. #ad",
  channels: ["shopee_video"]
});

const envFor = (db) => ({
  APP_SHARED_TOKEN: SHARED,
  APP_OWNER_TOKEN: OWNER,
  APPROVAL_DB: db
});

test("approval package is persisted as pending and cannot be approved with shared token", async () => {
  const db = fakeApprovalDb();
  const worker = await load();
  const created = await worker.fetch(request("/api/approvals", payload()), envFor(db));
  const data = await created.json();

  assert.equal(created.status, 201);
  assert.equal(data.status, "PENDING_OWNER_APPROVAL");
  assert.equal(db.rows.length, 1);

  const denied = await worker.fetch(
    request("/api/approvals", null, SHARED, "GET"),
    envFor(db)
  );
  assert.equal(denied.status, 401);
});

test("owner can list and approve the exact pending content version", async () => {
  const db = fakeApprovalDb();
  const worker = await load();
  const created = await (await worker.fetch(request("/api/approvals", payload()), envFor(db))).json();

  const listed = await worker.fetch(request("/api/approvals", null, OWNER, "GET"), envFor(db));
  const listData = await listed.json();
  assert.equal(listed.status, 200);
  assert.equal(listData.items.length, 1);
  assert.equal(listData.items[0].fingerprint, created.fingerprint);

  const decision = await worker.fetch(
    request("/api/approvals/" + created.contentId + "/decision", {
      version: created.version,
      decision: "approve",
      note: "Sudah diperiksa"
    }, OWNER),
    envFor(db)
  );
  const decisionData = await decision.json();
  assert.equal(decision.status, 200);
  assert.equal(decisionData.status, "APPROVED");
});

test("publisher validation fails closed before approval and accepts only exact approved package", async () => {
  const db = fakeApprovalDb();
  const worker = await load();
  const created = await (await worker.fetch(request("/api/approvals", payload()), envFor(db))).json();

  const reference = {
    contentId: created.contentId,
    version: created.version,
    fingerprint: created.fingerprint,
    channels: ["shopee_video"]
  };
  const pending = await worker.fetch(request("/api/publisher/validate", reference), envFor(db));
  assert.equal((await pending.json()).allowed, false);

  await worker.fetch(
    request("/api/approvals/" + created.contentId + "/decision", {
      version: created.version,
      decision: "approve"
    }, OWNER),
    envFor(db)
  );

  const approved = await worker.fetch(request("/api/publisher/validate", reference), envFor(db));
  assert.equal((await approved.json()).allowed, true);

  const changed = await worker.fetch(request("/api/publisher/validate", {
    ...reference,
    channels: ["youtube"]
  }), envFor(db));
  assert.equal((await changed.json()).allowed, false);
});

test("approval decision rejects invalid owner token and duplicate decisions", async () => {
  const db = fakeApprovalDb();
  const worker = await load();
  const created = await (await worker.fetch(request("/api/approvals", payload()), envFor(db))).json();

  const unauthorized = await worker.fetch(
    request("/api/approvals/" + created.contentId + "/decision", {
      version: created.version,
      decision: "approve"
    }, "wrong"),
    envFor(db)
  );
  assert.equal(unauthorized.status, 401);

  const first = await worker.fetch(
    request("/api/approvals/" + created.contentId + "/decision", {
      version: created.version,
      decision: "reject"
    }, OWNER),
    envFor(db)
  );
  assert.equal(first.status, 200);

  const second = await worker.fetch(
    request("/api/approvals/" + created.contentId + "/decision", {
      version: created.version,
      decision: "approve"
    }, OWNER),
    envFor(db)
  );
  assert.equal(second.status, 409);
});

test("approval package rejects invalid channel and non-HTTPS links", async () => {
  const db = fakeApprovalDb();
  const worker = await load();

  const invalidChannel = { ...payload(), channels: ["tiktok"] };
  const channelResponse = await worker.fetch(request("/api/approvals", invalidChannel), envFor(db));
  assert.equal(channelResponse.status, 400);

  const invalidLink = { ...payload(), affiliateLink: "javascript:alert(1)" };
  const linkResponse = await worker.fetch(request("/api/approvals", invalidLink), envFor(db));
  assert.equal(linkResponse.status, 400);
  assert.equal(db.rows.length, 0);
});
