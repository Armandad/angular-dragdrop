import type {
  ReelStrip,
  PaylineDef,
  PaytableConfig,
  FeatureConfig,
} from '@slot-engine/shared-types';
import type { IRNG } from '../rng/rng.js';
import { spinReels } from '../reels/reels.js';
import { evaluateSpin } from '../evaluator/evaluator.js';
import { playFreeSpins } from '../features/free-spins.js';

export interface SimulationConfig {
  totalSpins: number;
  betPerLine: number;
  activeLines: number;
  reelStrips: ReelStrip[];
  rowCount: number;
  paylines: PaylineDef[];
  paytable: PaytableConfig;
  features: FeatureConfig;
}

export interface SimulationResult {
  totalSpins: number;
  totalBet: number;
  totalWin: number;
  rtp: number;
  hitRate: number;
  freeSpinsTriggerRate: number;
  maxWin: number;
  /** Distribution of win/bet ratios */
  winDistribution: Record<string, number>;
  elapsedMs: number;
}

/**
 * Monte Carlo RTP simulator.
 * Runs millions of spins to verify mathematical convergence to target RTP.
 */
export function runSimulation(
  config: SimulationConfig,
  rng: IRNG,
  progressCallback?: (completed: number, total: number) => void,
): SimulationResult {
  const start = performance.now();
  const betPerSpin = config.betPerLine * config.activeLines;

  let totalBet = 0;
  let totalWin = 0;
  let hits = 0;
  let freeSpinTriggers = 0;
  let maxWin = 0;

  // Win distribution buckets: 0x, 1-2x, 2-5x, 5-10x, 10-50x, 50-100x, 100x+
  const distribution: Record<string, number> = {
    '0x': 0,
    '1-2x': 0,
    '2-5x': 0,
    '5-10x': 0,
    '10-50x': 0,
    '50-100x': 0,
    '100x+': 0,
  };

  const progressInterval = Math.floor(config.totalSpins / 100);

  for (let i = 0; i < config.totalSpins; i++) {
    totalBet += betPerSpin;

    const { window } = spinReels(config.reelStrips, config.rowCount, rng);
    const result = evaluateSpin(
      window,
      config.paylines,
      config.paytable,
      config.betPerLine,
      config.activeLines,
      config.features,
    );

    let spinWin = result.totalWin;

    // Process free spins if triggered
    if (result.freeSpinsAwarded > 0) {
      freeSpinTriggers++;
      const fsResult = playFreeSpins(
        config.reelStrips,
        config.rowCount,
        config.paylines,
        config.paytable,
        config.betPerLine,
        config.activeLines,
        config.features,
        rng,
      );
      spinWin += fsResult.totalWin;
    }

    totalWin += spinWin;

    if (spinWin > 0) {
      hits++;
      if (spinWin > maxWin) maxWin = spinWin;

      // Categorize win
      const ratio = spinWin / betPerSpin;
      if (ratio < 1) distribution['0x']!++;
      else if (ratio < 2) distribution['1-2x']!++;
      else if (ratio < 5) distribution['2-5x']!++;
      else if (ratio < 10) distribution['5-10x']!++;
      else if (ratio < 50) distribution['10-50x']!++;
      else if (ratio < 100) distribution['50-100x']!++;
      else distribution['100x+']!++;
    } else {
      distribution['0x']!++;
    }

    if (progressCallback && progressInterval > 0 && i % progressInterval === 0) {
      progressCallback(i, config.totalSpins);
    }
  }

  const elapsedMs = performance.now() - start;

  return {
    totalSpins: config.totalSpins,
    totalBet,
    totalWin,
    rtp: totalWin / totalBet,
    hitRate: hits / config.totalSpins,
    freeSpinsTriggerRate: freeSpinTriggers / config.totalSpins,
    maxWin,
    winDistribution: distribution,
    elapsedMs,
  };
}
