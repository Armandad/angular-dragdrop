-- ╔═══════════════════════════════════════════════════════╗
-- ║  Slot Engine Database Schema                         ║
-- ║  PostgreSQL 16+                                      ║
-- ╚═══════════════════════════════════════════════════════╝

-- Players
CREATE TABLE IF NOT EXISTS players (
  player_id       VARCHAR(64) PRIMARY KEY,
  external_id     VARCHAR(128),
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_players_external ON players(external_id);

-- Game rounds (audit trail — GLI/BMM compliant)
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
  round_type      VARCHAR(16) NOT NULL DEFAULT 'base' CHECK (round_type IN ('base', 'free_spin', 'gamble')),
  parent_round_id UUID REFERENCES game_rounds(round_id)
);

CREATE INDEX idx_rounds_player ON game_rounds(player_id, timestamp DESC);
CREATE INDEX idx_rounds_game ON game_rounds(game_id, timestamp DESC);
CREATE INDEX idx_rounds_timestamp ON game_rounds(timestamp DESC);

-- Transactions (wallet operations)
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       VARCHAR(64) NOT NULL REFERENCES players(player_id),
  round_id        UUID REFERENCES game_rounds(round_id),
  type            VARCHAR(16) NOT NULL CHECK (type IN ('bet', 'win', 'rollback', 'deposit', 'withdrawal')),
  amount          BIGINT NOT NULL,
  balance_before  BIGINT NOT NULL,
  balance_after   BIGINT NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(16) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'rolled_back'))
);

CREATE INDEX idx_transactions_player ON transactions(player_id, created_at DESC);
CREATE INDEX idx_transactions_round ON transactions(round_id);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);

-- Sessions
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

CREATE INDEX idx_sessions_player ON sessions(player_id);
CREATE INDEX idx_sessions_activity ON sessions(last_activity);

-- RTP tracking (for real-time monitoring)
CREATE TABLE IF NOT EXISTS rtp_tracking (
  id              SERIAL PRIMARY KEY,
  game_id         VARCHAR(64) NOT NULL,
  rtp_profile     INTEGER NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  total_rounds    BIGINT NOT NULL DEFAULT 0,
  total_bet       BIGINT NOT NULL DEFAULT 0,
  total_win       BIGINT NOT NULL DEFAULT 0,
  rtp             DECIMAL(8,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rtp_game_period ON rtp_tracking(game_id, period_start DESC);

-- Aggregator transactions (external wallet operations)
CREATE TABLE IF NOT EXISTS aggregator_transactions (
  id              SERIAL PRIMARY KEY,
  aggregator      VARCHAR(32) NOT NULL,
  player_id       VARCHAR(64) NOT NULL,
  round_id        UUID,
  type            VARCHAR(16) NOT NULL,
  amount          BIGINT NOT NULL,
  currency        VARCHAR(3) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_body    JSONB,
  response_body   JSONB,
  status_code     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agg_tx_player ON aggregator_transactions(player_id, created_at DESC);
CREATE INDEX idx_agg_tx_round ON aggregator_transactions(round_id);
CREATE UNIQUE INDEX idx_agg_tx_idempotency ON aggregator_transactions(aggregator, idempotency_key);

-- ╔═══════════════════════════════════════════════════════╗
-- ║  Views for reporting                                 ║
-- ╚═══════════════════════════════════════════════════════╝

-- Daily RTP summary
CREATE OR REPLACE VIEW daily_rtp AS
SELECT
  game_id,
  rtp_profile,
  DATE(timestamp) AS day,
  COUNT(*) AS rounds,
  SUM(total_bet) AS total_bet,
  SUM(total_win) AS total_win,
  CASE WHEN SUM(total_bet) > 0
    THEN ROUND(SUM(total_win)::DECIMAL / SUM(total_bet) * 100, 4)
    ELSE 0
  END AS rtp_percent
FROM game_rounds
GROUP BY game_id, rtp_profile, DATE(timestamp)
ORDER BY day DESC, game_id;

-- Player lifetime stats
CREATE OR REPLACE VIEW player_stats AS
SELECT
  player_id,
  COUNT(*) AS total_rounds,
  SUM(total_bet) AS lifetime_bet,
  SUM(total_win) AS lifetime_win,
  MAX(total_win) AS biggest_win,
  MIN(timestamp) AS first_play,
  MAX(timestamp) AS last_play,
  CASE WHEN SUM(total_bet) > 0
    THEN ROUND(SUM(total_win)::DECIMAL / SUM(total_bet) * 100, 4)
    ELSE 0
  END AS player_rtp
FROM game_rounds
GROUP BY player_id;
