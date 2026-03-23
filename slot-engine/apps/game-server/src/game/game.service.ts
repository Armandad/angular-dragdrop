import { randomUUID } from 'node:crypto';
import {
  FortunaRNG,
  spinReels,
  evaluateSpin,
  playGamble,
  playFreeSpins,
} from '@slot-engine/math-engine';
import type {
  GameSession,
  SpinRequest,
  SpinResponse,
  GambleRequest,
  GambleResponse,
  CollectRequest,
  CollectResponse,
  GameConfig,
} from '@slot-engine/shared-types';
import type { SessionStore } from '../session/session.store.js';
import type { GameRegistry } from './game.registry.js';
import type { AuditLogger } from '../audit/audit.logger.js';

export class GameService {
  private rng = new FortunaRNG();

  constructor(
    private sessionStore: SessionStore,
    private gameRegistry: GameRegistry,
    private auditLogger: AuditLogger,
  ) {}

  listGames(): GameConfig[] {
    return this.gameRegistry.getGameIds().map((id) => {
      const def = this.gameRegistry.getGame(id)!;
      return def.config;
    });
  }

  createSession(
    playerId: string,
    gameId: string,
    rtpProfile: number,
    initialBalance: number,
  ): GameSession {
    const def = this.gameRegistry.getGame(gameId);
    if (!def) throw new Error(`Game "${gameId}" not found`);

    const session: GameSession = {
      sessionId: randomUUID(),
      playerId,
      gameId,
      state: 'IDLE',
      balance: initialBalance,
      betPerLine: def.config.defaultDenomination,
      activeLines: def.config.maxBetLines,
      totalBet: def.config.defaultDenomination * def.config.maxBetLines,
      currentWin: 0,
      freeSpinsRemaining: 0,
      freeSpinsTotalWin: 0,
      gambleAttempts: 0,
      roundId: '',
      rtpProfile,
    };

    this.sessionStore.set(session.sessionId, session);
    return session;
  }

  spin(req: SpinRequest): SpinResponse {
    const session = this.getSessionOrThrow(req.sessionId);
    const def = this.gameRegistry.getGame(session.gameId)!;

    // Validate state
    if (session.state !== 'IDLE' && session.state !== 'FREE_SPINS') {
      throw new Error(`Cannot spin in state: ${session.state}`);
    }

    const betPerLine = req.betPerLine;
    const activeLines = req.activeLines;
    const totalBet = betPerLine * activeLines;
    const isFreeSpinRound = session.state === 'FREE_SPINS';

    // Deduct bet (free spins are free)
    if (!isFreeSpinRound) {
      if (session.balance < totalBet) {
        throw new Error('Insufficient balance');
      }
      session.balance -= totalBet;
      session.roundId = randomUUID();
      session.currentWin = 0;
    }

    // Get reel strips for the session's RTP profile
    const reelStrips = def.reelStrips[session.rtpProfile];
    if (!reelStrips) {
      throw new Error(`No reel strips for RTP ${session.rtpProfile}`);
    }

    // Spin the reels
    const { window } = spinReels(reelStrips, def.config.rowCount, this.rng);

    // Evaluate the spin
    const result = evaluateSpin(
      window,
      def.paylines,
      def.paytable,
      betPerLine,
      activeLines,
      def.config.features,
    );

    // Apply free spins multiplier
    let winAmount = result.totalWin;
    if (isFreeSpinRound && def.config.features.freeSpins) {
      winAmount *= def.config.features.freeSpins.multiplier;
    }

    session.currentWin += winAmount;

    // Handle free spins trigger
    if (result.freeSpinsAwarded > 0) {
      session.freeSpinsRemaining += result.freeSpinsAwarded;
      session.freeSpinsTotalWin = 0;
      session.state = 'FREE_SPINS';
    }

    // Update free spins state
    if (isFreeSpinRound) {
      session.freeSpinsRemaining--;
      session.freeSpinsTotalWin += winAmount;

      if (session.freeSpinsRemaining <= 0) {
        session.state = session.currentWin > 0 ? 'AWAITING_COLLECT' : 'IDLE';
      }
    } else if (winAmount > 0) {
      session.state = 'AWAITING_COLLECT';
    } else {
      session.state = 'IDLE';
    }

    // Update session
    session.betPerLine = betPerLine;
    session.activeLines = activeLines;
    session.totalBet = totalBet;
    this.sessionStore.set(session.sessionId, session);

    // Audit log
    this.auditLogger.logRound({
      roundId: session.roundId,
      playerId: session.playerId,
      gameId: session.gameId,
      timestamp: Date.now(),
      betPerLine,
      activeLines,
      totalBet,
      totalWin: winAmount,
      reelWindow: result.window,
      winLines: result.winLines,
      scatterWins: result.scatterWins,
      freeSpinsAwarded: result.freeSpinsAwarded,
      gambleResults: [],
      seedHash: '',
      seed: '',
      rtpProfile: session.rtpProfile,
    });

    return {
      roundId: session.roundId,
      result: { ...result, totalWin: winAmount },
      balance: session.balance,
      state: session.state,
      freeSpinsRemaining: session.freeSpinsRemaining,
    };
  }

  gamble(req: GambleRequest): GambleResponse {
    const session = this.getSessionOrThrow(req.sessionId);
    const def = this.gameRegistry.getGame(session.gameId)!;

    if (session.state !== 'AWAITING_COLLECT') {
      throw new Error(`Cannot gamble in state: ${session.state}`);
    }

    const gambleConfig = def.config.features.gamble;
    if (!gambleConfig) {
      throw new Error('Gamble feature not available');
    }

    if (session.gambleAttempts >= gambleConfig.maxAttempts) {
      throw new Error('Maximum gamble attempts reached');
    }

    const result = playGamble(
      session.currentWin,
      req.choice,
      gambleConfig,
      session.betPerLine,
      session.activeLines,
      this.rng,
    );

    session.gambleAttempts++;
    session.currentWin = result.newWinAmount;

    if (!result.won) {
      session.state = 'IDLE';
      session.gambleAttempts = 0;
    } else if (session.gambleAttempts >= gambleConfig.maxAttempts) {
      // Auto-collect at max attempts
      session.balance += session.currentWin;
      session.state = 'IDLE';
      session.gambleAttempts = 0;
    }

    this.sessionStore.set(session.sessionId, session);

    return {
      card: result.card,
      won: result.won,
      winAmount: session.currentWin,
      balance: session.balance,
      state: session.state,
      gambleAttemptsRemaining: gambleConfig.maxAttempts - session.gambleAttempts,
    };
  }

  collect(req: CollectRequest): CollectResponse {
    const session = this.getSessionOrThrow(req.sessionId);

    if (session.state !== 'AWAITING_COLLECT') {
      throw new Error(`Cannot collect in state: ${session.state}`);
    }

    const collected = session.currentWin;
    session.balance += collected;
    session.currentWin = 0;
    session.gambleAttempts = 0;
    session.state = 'IDLE';

    this.sessionStore.set(session.sessionId, session);

    return {
      collected,
      balance: session.balance,
      state: session.state,
    };
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessionStore.get(sessionId);
  }

  private getSessionOrThrow(sessionId: string): GameSession {
    const session = this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
    return session;
  }
}
