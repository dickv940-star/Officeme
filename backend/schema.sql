-- D1 schema for the Officeme backend. Mirrors the live `appdigi-approvals` database.
-- Apply to a NEW database with:
--   wrangler d1 execute <database-name> --remote --file=backend/schema.sql
-- The per-provider AI budget table (ai_provider_daily_budget) is created automatically by the Worker.

CREATE TABLE IF NOT EXISTS approval_packages (
  content_id    TEXT NOT NULL,
  version       INTEGER NOT NULL CHECK (version > 0),
  payload_json  TEXT NOT NULL,
  fingerprint   TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('PENDING_OWNER_APPROVAL', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED')),
  decision_note TEXT,
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  PRIMARY KEY (content_id, version)
);

CREATE INDEX IF NOT EXISTS idx_approval_packages_status_created
  ON approval_packages (status, created_at DESC);

-- Persistent two-way help requests between the eight AI agents and William.
CREATE TABLE IF NOT EXISTS agent_help_requests (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  agent_name      TEXT NOT NULL,
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL,
  task_text       TEXT,
  status          TEXT NOT NULL CHECK (status IN ('WAITING_FOR_WILLIAM', 'IN_PROGRESS', 'ANSWERED', 'NEEDS_MORE_INFO', 'COMPLETED', 'FAILED')),
  reply           TEXT,
  agent_result    TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  attachment_text TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  answered_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_help_status_updated
  ON agent_help_requests (status, updated_at DESC);

-- Per-agent memory and playbooks. Agents only PROPOSE notes; a note is used in
-- prompts only after William sets it ACTIVE. agent_id is an agent id or 'team'.
-- (Also created automatically by the Worker.)
CREATE TABLE IF NOT EXISTS agent_memory (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  status     TEXT NOT NULL,
  source     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_scope
  ON agent_memory (agent_id, status, updated_at DESC);

-- AI usage guards (also created automatically by the Worker).
CREATE TABLE IF NOT EXISTS ai_provider_daily_budget (
  day      TEXT NOT NULL,
  provider TEXT NOT NULL,
  calls    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);

CREATE TABLE IF NOT EXISTS ai_paid_usage (
  day      TEXT NOT NULL,
  provider TEXT NOT NULL,
  tokens   INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);

-- Legacy table kept in the live database.
CREATE TABLE IF NOT EXISTS ai_free_daily_budget (
  day   TEXT PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);

-- Affiliate operations tables present in the live database.
CREATE TABLE IF NOT EXISTS affiliate_products (
  product_id          TEXT PRIMARY KEY,
  product_name        TEXT NOT NULL,
  affiliate_url       TEXT NOT NULL,
  test_share          REAL NOT NULL DEFAULT 0.333333,
  active              INTEGER NOT NULL DEFAULT 1,
  actual_commission   REAL,
  commission_verified INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_content_queue (
  content_id    TEXT PRIMARY KEY,
  plan_date     TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  format        TEXT NOT NULL DEFAULT 'short_video',
  content_angle TEXT NOT NULL,
  hook          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'IDEA_ONLY',
  asset_url     TEXT,
  affiliate_url TEXT NOT NULL,
  human_approved INTEGER NOT NULL DEFAULT 0,
  published_at  TEXT,
  platform      TEXT,
  created_at    TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES affiliate_products (product_id)
);

CREATE TABLE IF NOT EXISTS affiliate_performance_daily (
  record_id            TEXT PRIMARY KEY,
  date                 TEXT NOT NULL,
  product_id           TEXT NOT NULL,
  content_id           TEXT,
  platform             TEXT,
  affiliate_clicks     INTEGER,
  orders               INTEGER,
  pending_commission   REAL,
  validated_commission REAL,
  cancelled_orders     INTEGER,
  source               TEXT NOT NULL DEFAULT 'not_imported',
  verified             INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES affiliate_products (product_id)
);

CREATE TABLE IF NOT EXISTS affiliate_ops_config (
  config_key   TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
