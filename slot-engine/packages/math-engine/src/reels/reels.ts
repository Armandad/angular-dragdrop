import type { ReelStrip, ReelWindow } from '@slot-engine/shared-types';
import type { IRNG } from '../rng/rng.js';

/**
 * Extracts a visible window from reel strips using random stop positions.
 * Each reel wraps around — treating the strip as circular.
 */
export function spinReels(
  reelStrips: ReelStrip[],
  rowCount: number,
  rng: IRNG,
): { window: ReelWindow; stopPositions: number[] } {
  const stopPositions: number[] = [];
  const window: ReelWindow = [];

  for (const strip of reelStrips) {
    const stopPos = rng.nextInt(strip.length);
    stopPositions.push(stopPos);

    const column: number[] = [];
    for (let row = 0; row < rowCount; row++) {
      const idx = (stopPos + row) % strip.length;
      column.push(strip[idx]!);
    }
    window.push(column);
  }

  return { window, stopPositions };
}

/**
 * Extracts a window from specific stop positions (for replay/audit).
 */
export function extractWindow(
  reelStrips: ReelStrip[],
  rowCount: number,
  stopPositions: number[],
): ReelWindow {
  const window: ReelWindow = [];

  for (let reel = 0; reel < reelStrips.length; reel++) {
    const strip = reelStrips[reel]!;
    const stopPos = stopPositions[reel]!;
    const column: number[] = [];

    for (let row = 0; row < rowCount; row++) {
      const idx = (stopPos + row) % strip.length;
      column.push(strip[idx]!);
    }
    window.push(column);
  }

  return window;
}
