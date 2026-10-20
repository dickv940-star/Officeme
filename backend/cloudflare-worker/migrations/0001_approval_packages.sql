CREATE TABLE IF NOT EXISTS approval_packages (
  content_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING_OWNER_APPROVAL', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED')),
  decision_note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  PRIMARY KEY (content_id, version)
);

CREATE INDEX IF NOT EXISTS idx_approval_packages_status_created
  ON approval_packages (status, created_at DESC);
