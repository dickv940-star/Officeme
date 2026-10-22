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
