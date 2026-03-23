import { createHmac } from 'node:crypto';
import type { SeedReveal } from '@slot-engine/shared-types';

/**
 * Client-side verifier for provably fair rounds.
 * Can verify that the server didn't manipulate the outcome after commitment.
 */
export class ProvablyFairVerifier {
  /**
   * Verifies that the revealed server seed matches the pre-committed hash.
   */
  static verify(reveal: SeedReveal): boolean {
    const expectedHash = createHmac('sha256', 'slot-engine-v1')
      .update(reveal.serverSeed)
      .digest('hex');
    return expectedHash === reveal.serverSeedHash;
  }

  /**
   * Recreates the round bytes from revealed seeds to verify outcomes.
   */
  static recreateRoundBytes(reveal: SeedReveal, count: number): Buffer {
    const hmac = createHmac('sha256', reveal.serverSeed);
    hmac.update(`${reveal.clientSeed}:${reveal.nonce}`);
    const hash = hmac.digest();

    if (count <= 32) {
      return hash.subarray(0, count);
    }

    const result = Buffer.alloc(count);
    let offset = 0;
    let chainInput = hash;

    while (offset < count) {
      const nextHmac = createHmac('sha256', reveal.serverSeed);
      nextHmac.update(chainInput);
      chainInput = nextHmac.digest();
      chainInput.copy(result, offset);
      offset += 32;
    }

    return result.subarray(0, count);
  }
}
