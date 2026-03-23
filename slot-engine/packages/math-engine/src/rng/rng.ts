import { randomInt } from 'node:crypto';

/**
 * RNG interface — allows swapping FortunaRNG (prod) for SeededRNG (test/audit).
 */
export interface IRNG {
  /** Returns a random integer in [0, max) */
  nextInt(max: number): number;
  /** Returns a random float in [0, 1) */
  nextFloat(): number;
}

/**
 * Production CSPRNG using Node.js crypto.randomInt().
 * Certification-ready (GLI-19 / BMM compliant).
 */
export class FortunaRNG implements IRNG {
  nextInt(max: number): number {
    if (max <= 0) throw new RangeError('max must be positive');
    if (max === 1) return 0;
    return randomInt(max);
  }

  nextFloat(): number {
    // 32-bit precision float in [0, 1)
    return this.nextInt(0x100000000) / 0x100000000;
  }
}

/**
 * Seeded PRNG for deterministic testing and audit replay.
 * Uses a simple xoshiro128** algorithm — NOT for production use.
 */
export class SeededRNG implements IRNG {
  private state: Uint32Array;

  constructor(seed: number) {
    this.state = new Uint32Array(4);
    // SplitMix32 seed expansion
    let s = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = (z ^ (z >>> 16)) >>> 0;
      z = Math.imul(z, 0x85ebca6b) >>> 0;
      z = (z ^ (z >>> 13)) >>> 0;
      z = Math.imul(z, 0xc2b2ae35) >>> 0;
      z = (z ^ (z >>> 16)) >>> 0;
      this.state[i] = z;
    }
  }

  private next(): number {
    const s = this.state;
    const result = (Math.imul(s[1]! * 5, 1) << 7 | (s[1]! * 5) >>> 25) * 9;
    const t = s[1]! << 9;

    s[2]! !== undefined && (s[2] ^= s[0]!);
    s[3]! !== undefined && (s[3] ^= s[1]!);
    s[1]! !== undefined && (s[1] ^= s[2]!);
    s[0]! !== undefined && (s[0] ^= s[3]!);

    s[2] ^= t;
    s[3] = (s[3]! << 11 | s[3]! >>> 21);

    return result >>> 0;
  }

  nextInt(max: number): number {
    if (max <= 0) throw new RangeError('max must be positive');
    if (max === 1) return 0;
    return this.next() % max;
  }

  nextFloat(): number {
    return this.next() / 0x100000000;
  }
}
