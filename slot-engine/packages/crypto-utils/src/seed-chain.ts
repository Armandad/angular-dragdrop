import { createHmac, randomBytes } from 'node:crypto';
import type { SeedCommitment, SeedReveal } from '@slot-engine/shared-types';

/**
 * HMAC-SHA256 seed chain for provably fair rounds.
 *
 * Flow:
 * 1. Server generates a random seed and commits its HMAC hash before play
 * 2. Client provides their seed (or uses a default)
 * 3. After the round, server reveals the seed for verification
 * 4. Combined seed determines the round outcome
 */
export class SeedChain {
  private serverSeed: string;
  private nonce: number;

  constructor(
    private readonly clientSeed: string = 'default',
    serverSeed?: string,
  ) {
    this.serverSeed = serverSeed ?? randomBytes(32).toString('hex');
    this.nonce = 0;
  }

  /**
   * Creates a commitment hash that is shared with the player before play.
   */
  getCommitment(): SeedCommitment {
    return {
      serverSeedHash: this.hashSeed(this.serverSeed),
      clientSeed: this.clientSeed,
      nonce: this.nonce,
    };
  }

  /**
   * Generates deterministic bytes for the current round.
   * Used to derive RNG values for provably fair verification.
   */
  generateRoundBytes(count: number): Buffer {
    const hmac = createHmac('sha256', this.serverSeed);
    hmac.update(`${this.clientSeed}:${this.nonce}`);
    const hash = hmac.digest();

    // For more bytes, chain multiple HMACs
    if (count <= 32) {
      return hash.subarray(0, count);
    }

    const result = Buffer.alloc(count);
    let offset = 0;
    let chainInput = hash;

    while (offset < count) {
      const nextHmac = createHmac('sha256', this.serverSeed);
      nextHmac.update(chainInput);
      chainInput = nextHmac.digest();
      chainInput.copy(result, offset);
      offset += 32;
    }

    return result.subarray(0, count);
  }

  /**
   * Advances to the next round, incrementing the nonce.
   */
  nextRound(): void {
    this.nonce++;
  }

  /**
   * Reveals the server seed for verification after round completion.
   */
  reveal(): SeedReveal {
    return {
      serverSeed: this.serverSeed,
      serverSeedHash: this.hashSeed(this.serverSeed),
      clientSeed: this.clientSeed,
      nonce: this.nonce,
    };
  }

  /**
   * Rotates to a new server seed. Call periodically for security.
   */
  rotate(): SeedCommitment {
    this.serverSeed = randomBytes(32).toString('hex');
    this.nonce = 0;
    return this.getCommitment();
  }

  private hashSeed(seed: string): string {
    return createHmac('sha256', 'slot-engine-v1').update(seed).digest('hex');
  }
}
