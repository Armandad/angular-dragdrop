import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { spinReels, extractWindow } from './reels.js';
import { SeededRNG } from '../rng/rng.js';

const REEL_STRIPS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  [0, 2, 4, 6, 8, 1, 3, 5, 7, 9],
  [1, 3, 5, 7, 9, 0, 2, 4, 6, 8],
  [5, 5, 5, 5, 5, 0, 0, 0, 0, 0],
];

describe('spinReels', () => {
  it('should return a window with correct dimensions', () => {
    const rng = new SeededRNG(42);
    const { window } = spinReels(REEL_STRIPS, 3, rng);

    assert.equal(window.length, 5, 'Should have 5 reels');
    for (const col of window) {
      assert.equal(col.length, 3, 'Each reel should have 3 rows');
    }
  });

  it('should return valid stop positions', () => {
    const rng = new SeededRNG(42);
    const { stopPositions } = spinReels(REEL_STRIPS, 3, rng);

    assert.equal(stopPositions.length, 5);
    for (let i = 0; i < stopPositions.length; i++) {
      assert.ok(stopPositions[i]! >= 0, 'Stop position must be >= 0');
      assert.ok(
        stopPositions[i]! < REEL_STRIPS[i]!.length,
        'Stop position must be < strip length',
      );
    }
  });

  it('should produce deterministic results with SeededRNG', () => {
    const rng1 = new SeededRNG(100);
    const rng2 = new SeededRNG(100);

    const result1 = spinReels(REEL_STRIPS, 3, rng1);
    const result2 = spinReels(REEL_STRIPS, 3, rng2);

    assert.deepEqual(result1.window, result2.window);
    assert.deepEqual(result1.stopPositions, result2.stopPositions);
  });

  it('should wrap around circular strips', () => {
    const rng = new SeededRNG(42);
    // Force a stop near the end by using a small strip
    const shortStrips = [[0, 1, 2]];
    const { window, stopPositions } = spinReels(shortStrips, 3, rng);

    // Whatever stop position, all 3 symbols should be valid
    assert.equal(window[0]!.length, 3);
    for (const sym of window[0]!) {
      assert.ok([0, 1, 2].includes(sym), `Invalid symbol ${sym}`);
    }
  });
});

describe('extractWindow', () => {
  it('should extract the correct window from stop positions', () => {
    const window = extractWindow(REEL_STRIPS, 3, [0, 0, 0, 0, 0]);

    // First reel, stop 0: symbols 0, 1, 2
    assert.deepEqual(window[0], [0, 1, 2]);
    // Second reel, stop 0: symbols 9, 8, 7
    assert.deepEqual(window[1], [9, 8, 7]);
  });

  it('should handle wrap-around correctly', () => {
    // Stop at position 8 on a 10-symbol strip, should get 8, 9, 0
    const window = extractWindow(REEL_STRIPS, 3, [8, 0, 0, 0, 0]);
    assert.deepEqual(window[0], [8, 9, 0]);
  });

  it('should match spinReels output', () => {
    const rng = new SeededRNG(42);
    const { window: spunWindow, stopPositions } = spinReels(REEL_STRIPS, 3, rng);
    const extractedWindow = extractWindow(REEL_STRIPS, 3, stopPositions);

    assert.deepEqual(spunWindow, extractedWindow);
  });
});
