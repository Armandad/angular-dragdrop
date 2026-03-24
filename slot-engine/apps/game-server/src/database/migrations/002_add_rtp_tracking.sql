-- Add RTP tracking table and aggregator transactions

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

CREATE INDEX IF NOT EXISTS idx_rtp_game_period ON rtp_tracking(game_id, period_start DESC);

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

CREATE INDEX IF NOT EXISTS idx_agg_tx_player ON aggregator_transactions(player_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agg_tx_idempotency ON aggregator_transactions(aggregator, idempotency_key);

-- Reporting views
CREATE OR REPLACE VIEW daily_rtp AS
SELECT
  game_id, rtp_profile,
  DATE(timestamp) AS day,
  COUNT(*) AS rounds,
  SUM(total_bet) AS total_bet,
  SUM(total_win) AS total_win,
  CASE WHEN SUM(total_bet) > 0
    THEN ROUND(SUM(total_win)::DECIMAL / SUM(total_bet) * 100, 4) ELSE 0
  END AS rtp_percent
FROM game_rounds
GROUP BY game_id, rtp_profile, DATE(timestamp);

CREATE OR REPLACE VIEW player_stats AS
SELECT
  player_id,
  COUNT(*) AS total_rounds,
  SUM(total_bet) AS lifetime_bet,
  SUM(total_win) AS lifetime_win,
  MAX(total_win) AS biggest_win,
  MIN(timestamp) AS first_play,
  MAX(timestamp) AS last_play
FROM game_rounds
GROUP BY player_id;
