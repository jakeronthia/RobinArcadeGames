-- ROBIN Arcade leaderboard database (Cloudflare D1)
-- Paste this whole file into the D1 console once (Cloudflare dashboard -> D1 -> your database -> Console).

CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  account TEXT PRIMARY KEY,
  nick TEXT NOT NULL DEFAULT '',
  hero TEXT NOT NULL DEFAULT '',
  banned INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  game TEXT NOT NULL,
  started INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS runs_by_account ON runs(account, started);

CREATE TABLE IF NOT EXISTS scores (
  week TEXT NOT NULL,
  game TEXT NOT NULL,
  account TEXT NOT NULL,
  value INTEGER NOT NULL,
  runs INTEGER NOT NULL DEFAULT 1,
  updated INTEGER NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, game, account)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores(week, game, value DESC);

CREATE TABLE IF NOT EXISTS paid (
  week TEXT NOT NULL,
  game TEXT NOT NULL,
  rank INTEGER NOT NULL,
  account TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at INTEGER NOT NULL,
  PRIMARY KEY (week, game, rank)
);
