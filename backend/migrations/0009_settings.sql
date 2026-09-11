-- Migration number: 0009 	 2026-09-11T00:00:00.000Z

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', 'false');
