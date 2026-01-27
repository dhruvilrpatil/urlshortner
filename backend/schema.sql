CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    click_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_urls_code ON urls (code);
CREATE INDEX IF NOT EXISTS idx_urls_original_url ON urls (original_url);
CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls (expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT NOT NULL,
    bucket TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (ip, bucket)
);

CREATE TABLE IF NOT EXISTS spam_submissions (
    ip TEXT NOT NULL,
    original_url TEXT NOT NULL,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (ip, original_url)
);
