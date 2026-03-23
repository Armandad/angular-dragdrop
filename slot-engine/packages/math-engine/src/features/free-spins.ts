import type {
  ReelStrip,
  PaylineDef,
  PaytableConfig,
  FeatureConfig,
  SpinResult,
} from '@slot-engine/shared-types';
import type { IRNG } from '../rng/rng.js';
import { spinReels } from '../reels/reels.js';
import { evaluateSpin } from '../evaluator/evaluator.js';

export interface FreeSpinsResult {
  spins: SpinResult[];
  totalWin: number;
  totalSpinsPlayed: number;
  retriggers: number;
}

/**
 * Executes a full free spins bonus round.
 * Supports retriggers up to the configured maximum.
 */
export function playFreeSpins(
  reelStrips: ReelStrip[],
  rowCount: number,
  paylines: PaylineDef[],
  paytable: PaytableConfig,
  betPerLine: number,
  activeLines: number,
  features: FeatureConfig,
  rng: IRNG,
): FreeSpinsResult {
  const fsConfig = features.freeSpins;
  if (!fsConfig) {
    return { spins: [], totalWin: 0, totalSpinsPlayed: 0, retriggers: 0 };
  }

  let spinsRemaining = fsConfig.spinsAwarded;
  let retriggers = 0;
  const spins: SpinResult[] = [];
  let totalWin = 0;

  while (spinsRemaining > 0) {
    spinsRemaining--;

    const { window } = spinReels(reelStrips, rowCount, rng);
    const result = evaluateSpin(
      window,
      paylines,
      paytable,
      betPerLine,
      activeLines,
      features,
    );

    // Apply free spins multiplier
    const multipliedWin = result.totalWin * fsConfig.multiplier;
    const multipliedResult: SpinResult = {
      ...result,
      totalWin: multipliedWin,
    };

    spins.push(multipliedResult);
    totalWin += multipliedWin;

    // Check for retrigger
    if (
      result.freeSpinsAwarded > 0 &&
      fsConfig.retrigger &&
      retriggers < fsConfig.maxRetriggers
    ) {
      spinsRemaining += fsConfig.spinsAwarded;
      retriggers++;
    }
  }

  return {
    spins,
    totalWin,
    totalSpinsPlayed: spins.length,
    retriggers,
  };
}
