-- Dedicated lead metadata; no raw address, IP, query string, or token.
CREATE TABLE IF NOT EXISTS email_signups (
  email_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  freebie TEXT NOT NULL,
  segment TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  PRIMARY KEY (email_hash, freebie)
);
