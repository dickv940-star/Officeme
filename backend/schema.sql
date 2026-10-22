-- D1 schema for the Officeme backend. Apply once:
--   wrangler d1 execute <database-name> --remote --file=backend/schema.sql
-- (The per-provider AI budget table is created automatically by the Worker.)

CREATE TABLE IF NOT EXISTS approval_packages (
  content_id    TEXT    NOT NULL,
  version       INTEGER NOT NULL,
  payload_json  TEXT    NOT NULL,
  fingerprint   TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'PENDING_OWNER_APPROVAL',
  decision_note TEXT,
  created_at    TEXT    NOT NULL,
  decided_at    TEXT,
  PRIMARY KEY (content_id, version)
);

CREATE INDEX IF NOT EXISTS idx_approval_packages_created
  ON approval_packages (created_at DESC);
