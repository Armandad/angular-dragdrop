import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  validateGameConfig,
  validatePaytable,
  validatePaylines,
  validateReelStrips,
  loadGameDefinition,
} from './loader.js';

describe('validateGameConfig', () => {
  it('should accept a valid config', () => {
    const config = {
      gameId: 'test-game',
      name: 'Test Game',
      reelCount: 5,
      rowCount: 3,
      paylineCount: 10,
      denominations: [1, 2, 5],
      defaultDenomination: 1,
      minBetLines: 1,
      maxBetLines: 10,
      features: {},
      rtpTargets: [96],
    };

    assert.ok(validateGameConfig(config));
  });

  it('should reject missing gameId', () => {
    assert.throws(
      () => validateGameConfig({ name: 'Test', reelCount: 5, rowCount: 3, denominations: [1] }),
      /gameId must be a string/,
    );
  });

  it('should reject reelCount < 3', () => {
    assert.throws(
      () => validateGameConfig({ gameId: 'test', name: 'T', reelCount: 2, rowCount: 3, denominations: [1] }),
      /reelCount must be >= 3/,
    );
  });

  it('should reject empty denominations', () => {
    assert.throws(
      () => validateGameConfig({ gameId: 'test', name: 'T', reelCount: 5, rowCount: 3, denominations: [] }),
      /denominations must be a non-empty array/,
    );
  });
});

describe('validatePaytable', () => {
  it('should accept a valid paytable', () => {
    const paytable = {
      symbols: [{ id: 0, name: 'Test', type: 'regular' }],
      pays: { 0: { 3: 10 } },
    };
    assert.ok(validatePaytable(paytable));
  });

  it('should reject empty symbols', () => {
    assert.throws(
      () => validatePaytable({ symbols: [], pays: {} }),
      /symbols must be a non-empty array/,
    );
  });
});

describe('validatePaylines', () => {
  it('should accept valid paylines', () => {
    const paylines = [[0, 1, 2, 0, 1], [1, 0, 1, 2, 0]];
    assert.ok(validatePaylines(paylines, 5, 3));
  });

  it('should reject wrong number of positions', () => {
    assert.throws(
      () => validatePaylines([[0, 1, 2]], 5, 3),
      /must have 5 positions/,
    );
  });

  it('should reject out-of-range row indices', () => {
    assert.throws(
      () => validatePaylines([[0, 1, 5, 0, 1]], 5, 3),
      /invalid row index 5/,
    );
  });
});

describe('validateReelStrips', () => {
  it('should accept valid reel strips', () => {
    const strips = Array.from({ length: 5 }, () => Array.from({ length: 20 }, (_, i) => i % 5));
    assert.ok(validateReelStrips(strips, 5));
  });

  it('should reject wrong number of strips', () => {
    const strips = [Array.from({ length: 20 }, () => 0)];
    assert.throws(
      () => validateReelStrips(strips, 5),
      /Expected 5 reel strips/,
    );
  });

  it('should reject strips that are too short', () => {
    const strips = Array.from({ length: 5 }, () => [0, 1, 2]);
    assert.throws(
      () => validateReelStrips(strips, 5),
      /at least 10 symbols/,
    );
  });
});

describe('loadGameDefinition', () => {
  it('should load a complete game definition', () => {
    const config = {
      gameId: 'test', name: 'Test', reelCount: 5, rowCount: 3,
      paylineCount: 1, denominations: [1], defaultDenomination: 1,
      minBetLines: 1, maxBetLines: 1, features: {}, rtpTargets: [96],
    };
    const paytable = {
      symbols: [{ id: 0, name: 'A', type: 'regular' }],
      pays: { 0: { 3: 10 } },
    };
    const paylines = [[1, 1, 1, 1, 1]];
    const strips = Array.from({ length: 5 }, () => Array.from({ length: 20 }, (_, i) => i % 3));

    const def = loadGameDefinition(config, paytable, paylines, { 96: strips });

    assert.equal(def.config.gameId, 'test');
    assert.ok(def.reelStrips[96]);
    assert.equal(def.paylines.length, 1);
  });
});
