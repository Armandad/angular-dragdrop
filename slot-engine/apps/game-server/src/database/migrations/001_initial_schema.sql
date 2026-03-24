-- Initial database schema for Slot Engine
-- This is the base schema from which all future migrations build.

CREATE TABLE IF NOT EXISTS players (
  player_id       VARCHAR(64) PRIMARY KEY,
  external_id     VARCHAR(128),
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_external ON players(external_id);

CREATE TABLE IF NOT EXISTS game_rounds (
  round_id        UUID PRIMARY KEY,
  player_id       VARCHAR(64) NOT NULL REFERENCES players(player_id),
  game_id         VARCHAR(64) NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bet_per_line    INTEGER NOT NULL,
  active_lines    INTEGER NOT NULL,
  total_bet       BIGINT NOT NULL,
  total_win       BIGINT NOT NULL,
  reel_window     JSONB NOT NULL,
  win_lines       JSONB NOT NULL DEFAULT '[]',
  scatter_wins    JSONB NOT NULL DEFAULT '[]',
  free_spins_awarded INTEGER NOT NULL DEFAULT 0,
  gamble_results  JSONB NOT NULL DEFAULT '[]',
  seed_hash       VARCHAR(128),
  seed            VARCHAR(128),
  rtp_profile     INTEGER NOT NULL,
  round_type      VARCHAR(16) NOT NULL DEFAULT 'base',
  parent_round_id UUID REFERENCES game_rounds(round_id)
);

CREATE INDEX IF NOT EXISTS idx_rounds_player ON game_rounds(player_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_game ON game_rounds(game_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       VARCHAR(64) NOT NULL REFERENCES players(player_id),
  round_id        UUID REFERENCES game_rounds(round_id),
  type            VARCHAR(16) NOT NULL,
  amount          BIGINT NOT NULL,
  balance_before  BIGINT NOT NULL,
  balance_after   BIGINT NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(16) NOT NULL DEFAULT 'completed'
);

CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_round ON transactions(round_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_id      UUID PRIMARY KEY,
  player_id       VARCHAR(64) NOT NULL REFERENCES players(player_id),
  game_id         VARCHAR(64) NOT NULL,
  state           VARCHAR(32) NOT NULL DEFAULT 'IDLE',
  rtp_profile     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
