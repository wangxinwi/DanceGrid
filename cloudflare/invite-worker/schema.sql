CREATE TABLE IF NOT EXISTS seats (
  id TEXT PRIMARY KEY,
  seat_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL,
  device_id TEXT,
  invite_code_hash TEXT,
  invite_code_label TEXT,
  note TEXT,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  released_at INTEGER
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  code_label TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  status TEXT NOT NULL,
  max_redemptions INTEGER NOT NULL DEFAULT 1,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER,
  redeemed_at INTEGER,
  redeemed_device_id TEXT,
  revoked_at INTEGER,
  note TEXT,
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON invite_codes(status);
CREATE INDEX IF NOT EXISTS idx_invite_codes_app ON invite_codes(app);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);

