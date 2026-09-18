CREATE TABLE IF NOT EXISTS events (
 event_id TEXT PRIMARY KEY, observed_at TEXT NOT NULL, event_type TEXT NOT NULL,
 product_id TEXT, campaign_id TEXT, is_test INTEGER NOT NULL DEFAULT 0,
 record_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_date ON events(observed_at);
CREATE VIEW IF NOT EXISTS production_events AS SELECT * FROM events WHERE is_test=0;
