import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SeedChain } from './seed-chain.js';
import { ProvablyFairVerifier } from './verifier.js';

describe('SeedChain', () => {
  it('should create a commitment with a hash', () => {
    const chain = new SeedChain('client123');
    const commitment = chain.getCommitment();

    assert.ok(commitment.serverSeedHash.length > 0);
    assert.equal(commitment.clientSeed, 'client123');
    assert.equal(commitment.nonce, 0);
  });

  it('should reveal a seed that matches the commitment', () => {
    const chain = new SeedChain('client123');
    const commitment = chain.getCommitment();
    const reveal = chain.reveal();

    assert.equal(reveal.serverSeedHash, commitment.serverSeedHash);
    assert.equal(reveal.clientSeed, 'client123');
  });

  it('should increment nonce on nextRound', () => {
    const chain = new SeedChain();
    assert.equal(chain.getCommitment().nonce, 0);
    chain.nextRound();
    assert.equal(chain.getCommitment().nonce, 1);
    chain.nextRound();
    assert.equal(chain.getCommitment().nonce, 2);
  });

  it('should generate reproducible round bytes', () => {
    const chain1 = new SeedChain('client', 'server-seed-abc');
    const chain2 = new SeedChain('client', 'server-seed-abc');

    const bytes1 = chain1.generateRoundBytes(16);
    const bytes2 = chain2.generateRoundBytes(16);

    assert.deepEqual(bytes1, bytes2);
  });

  it('should generate different bytes with different nonces', () => {
    const chain = new SeedChain('client', 'server-seed-abc');

    const bytes0 = chain.generateRoundBytes(16);
    chain.nextRound();
    const bytes1 = chain.generateRoundBytes(16);

    assert.notDeepEqual(bytes0, bytes1);
  });

  it('should generate bytes longer than 32 via chaining', () => {
    const chain = new SeedChain('client', 'server-seed-abc');
    const bytes = chain.generateRoundBytes(64);

    assert.equal(bytes.length, 64);
  });

  it('should rotate to a new seed', () => {
    const chain = new SeedChain();
    const commit1 = chain.getCommitment();
    const commit2 = chain.rotate();

    assert.notEqual(commit1.serverSeedHash, commit2.serverSeedHash);
    assert.equal(commit2.nonce, 0);
  });
});

describe('ProvablyFairVerifier', () => {
  it('should verify a valid seed reveal', () => {
    const chain = new SeedChain('client', 'known-server-seed');
    const reveal = chain.reveal();

    assert.ok(ProvablyFairVerifier.verify(reveal));
  });

  it('should reject a tampered seed reveal', () => {
    const chain = new SeedChain('client', 'known-server-seed');
    const reveal = chain.reveal();

    // Tamper with the server seed
    reveal.serverSeed = 'tampered-seed';
    assert.equal(ProvablyFairVerifier.verify(reveal), false);
  });

  it('should recreate identical round bytes', () => {
    const chain = new SeedChain('client', 'server-seed-xyz');
    const roundBytes = chain.generateRoundBytes(32);
    const reveal = chain.reveal();

    const recreated = ProvablyFairVerifier.recreateRoundBytes(reveal, 32);
    assert.deepEqual(roundBytes, recreated);
  });
});
