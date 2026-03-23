import type { AuditRound } from '@slot-engine/shared-types';

/**
 * PostgreSQL-backed audit logger for production use.
 * Writes every round to the game_rounds table for GLI/BMM compliance.
 *
 * Requires a pg Pool connection — pass the pool instance.
 * Falls back to console logging if pool is not available.
 */
export class PgAuditLogger {
  private pool: unknown; // pg.Pool — dynamically imported

  constructor(databaseUrl?: string) {
    const url = databaseUrl ?? process.env['DATABASE_URL'];
    if (url) {
      this.initPool(url).catch((err) => {
        console.warn('PgAuditLogger: Failed to connect to PostgreSQL:', err);
      });
    }
  }

  private async initPool(url: string): Promise<void> {
    try {
      // Dynamic import to avoid hard dependency on pg
      const { Pool } = await import('pg') as { Pool: new (config: { connectionString: string }) => unknown };
      this.pool = new Pool({ connectionString: url });
      console.log('PgAuditLogger: Connected to PostgreSQL');
    } catch {
      console.warn('PgAuditLogger: pg module not available, using console logging');
    }
  }

  async logRound(round: AuditRound): Promise<void> {
    if (!this.pool) {
      // Fallback to console
      console.log(
        `[AUDIT] Round ${round.roundId}: bet=${round.totalBet} win=${round.totalWin} game=${round.gameId}`,
      );
      return;
    }

    try {
      const pool = this.pool as { query: (text: string, values: unknown[]) => Promise<unknown> };
      await pool.query(
        `INSERT INTO game_rounds (
          round_id, player_id, game_id, timestamp,
          bet_per_line, active_lines, total_bet, total_win,
          reel_window, win_lines, scatter_wins,
          free_spins_awarded, gamble_results,
          seed_hash, seed, rtp_profile
        ) VALUES ($1, $2, $3, to_timestamp($4::double precision / 1000), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          round.roundId,
          round.playerId,
          round.gameId,
          round.timestamp,
          round.betPerLine,
          round.activeLines,
          round.totalBet,
          round.totalWin,
          JSON.stringify(round.reelWindow),
          JSON.stringify(round.winLines),
          JSON.stringify(round.scatterWins),
          round.freeSpinsAwarded,
          JSON.stringify(round.gambleResults),
          round.seedHash,
          round.seed,
          round.rtpProfile,
        ],
      );
    } catch (err) {
      console.error('PgAuditLogger: Failed to log round:', err);
      // Fallback to console — never lose audit data
      console.log(`[AUDIT-FALLBACK] ${JSON.stringify(round)}`);
    }
  }
}
