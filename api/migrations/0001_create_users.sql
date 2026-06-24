CREATE TABLE users (
  address TEXT PRIMARY KEY,
  display_name TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'USD',
  registered_at TEXT NOT NULL,
  registered_ip TEXT,
  last_login_at TEXT NOT NULL,
  last_login_ip TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_last_login_at ON users(last_login_at);
