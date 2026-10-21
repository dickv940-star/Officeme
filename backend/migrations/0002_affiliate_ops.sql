-- Optional explicit D1 migration for the Shopee Affiliate operations queue.
-- The Worker also uses CREATE TABLE IF NOT EXISTS at runtime.
CREATE TABLE IF NOT EXISTS affiliate_ops_tasks (
  id TEXT PRIMARY KEY,
  task_date TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  product_url TEXT NOT NULL DEFAULT '',
  affiliate_url TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  script TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  shot_list_json TEXT NOT NULL DEFAULT '[]',
  video_asset_url TEXT NOT NULL DEFAULT '',
  channels_json TEXT NOT NULL DEFAULT '["shopee_video","instagram_story","youtube_shorts"]',
  status TEXT NOT NULL DEFAULT 'IDEA',
  decision_note TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(task_date, sequence)
);
CREATE TABLE IF NOT EXISTS affiliate_ops_daily (
  task_date TEXT PRIMARY KEY,
  target_videos INTEGER NOT NULL DEFAULT 10,
  created_tasks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS affiliate_ops_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliate_ops_tasks_date ON affiliate_ops_tasks(task_date, sequence);
CREATE INDEX IF NOT EXISTS idx_affiliate_ops_metrics_task_date ON affiliate_ops_metrics(task_id, metric_date);
