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
