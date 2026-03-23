import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { FortunaRNG, SeededRNG } from './rng.js';

describe('FortunaRNG', () => {
  const rng = new FortunaRNG();

  it('should generate integers in range [0, max)', () => {
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextInt(10);
      assert.ok(val >= 0 && val < 10, `Expected 0-9, got ${val}`);
    }
  });

  it('should return 0 when max is 1', () => {
    assert.equal(rng.nextInt(1), 0);
  });

  it('should throw on non-positive max', () => {
    assert.throws(() => rng.nextInt(0), /max must be positive/);
    assert.throws(() => rng.nextInt(-5), /max must be positive/);
  });

  it('should generate floats in range [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextFloat();
      assert.ok(val >= 0 && val < 1, `Expected [0,1), got ${val}`);
    }
  });

  it('should produce different values (not stuck)', () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      values.add(rng.nextInt(1000));
    }
    assert.ok(values.size > 50, `Expected variety, got only ${values.size} unique values`);
  });
});

describe('SeededRNG', () => {
  it('should produce deterministic results with same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    for (let i = 0; i < 100; i++) {
      assert.equal(rng1.nextInt(1000), rng2.nextInt(1000));
    }
  });

  it('should produce different results with different seeds', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(99);

    let same = 0;
    for (let i = 0; i < 100; i++) {
      if (rng1.nextInt(1000) === rng2.nextInt(1000)) same++;
    }
    assert.ok(same < 10, `Expected different sequences, got ${same}/100 matches`);
  });

  it('should generate integers in valid range', () => {
    const rng = new SeededRNG(12345);
    for (let i = 0; i < 10000; i++) {
      const val = rng.nextInt(6);
      assert.ok(val >= 0 && val < 6, `Expected 0-5, got ${val}`);
    }
  });

  it('should generate floats in [0, 1)', () => {
    const rng = new SeededRNG(999);
    for (let i = 0; i < 1000; i++) {
      const val = rng.nextFloat();
      assert.ok(val >= 0 && val < 1, `Expected [0,1), got ${val}`);
    }
  });

  it('should have reasonable distribution', () => {
    const rng = new SeededRNG(77);
    const buckets = new Array(6).fill(0);
    const n = 60000;

    for (let i = 0; i < n; i++) {
      buckets[rng.nextInt(6)]++;
    }

    const expected = n / 6;
    for (let i = 0; i < 6; i++) {
      const deviation = Math.abs((buckets[i] as number) - expected) / expected;
      assert.ok(deviation < 0.05, `Bucket ${i}: deviation ${(deviation * 100).toFixed(1)}% > 5%`);
    }
  });
});
