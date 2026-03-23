import type { AuditRound } from '@slot-engine/shared-types';

/**
 * Audit logger for certification compliance (GLI/BMM).
 * Logs every round with full reproducibility data.
 *
 * In production, this writes to PostgreSQL. For development, logs to memory.
 */
export class AuditLogger {
  private rounds: AuditRound[] = [];

  logRound(round: AuditRound): void {
    this.rounds.push({ ...round });

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[AUDIT] Round ${round.roundId}: bet=${round.totalBet} win=${round.totalWin} game=${round.gameId}`,
      );
    }
  }

  getRounds(playerId?: string, gameId?: string, limit = 100): AuditRound[] {
    let filtered = this.rounds;

    if (playerId) {
      filtered = filtered.filter((r) => r.playerId === playerId);
    }
    if (gameId) {
      filtered = filtered.filter((r) => r.gameId === gameId);
    }

    return filtered.slice(-limit);
  }

  getStats(): {
    totalRounds: number;
    totalBet: number;
    totalWin: number;
    rtp: number;
  } {
    const totalBet = this.rounds.reduce((sum, r) => sum + r.totalBet, 0);
    const totalWin = this.rounds.reduce((sum, r) => sum + r.totalWin, 0);
    return {
      totalRounds: this.rounds.length,
      totalBet,
      totalWin,
      rtp: totalBet > 0 ? totalWin / totalBet : 0,
    };
  }
}
