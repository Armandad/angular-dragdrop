import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { LocalWalletAdapter } from '../wallet/wallet.adapter.js';

describe('LocalWalletAdapter', () => {
  it('should get balance for a player', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 5000);

    const balance = await wallet.getBalance('p1', 'USD');
    assert.equal(balance, 5000);
  });

  it('should return 0 for unknown players', async () => {
    const wallet = new LocalWalletAdapter();
    const balance = await wallet.getBalance('unknown', 'USD');
    assert.equal(balance, 0);
  });

  it('should debit successfully', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 1000);

    const result = await wallet.debit('p1', 100, 'USD', 'round-1', 'key-1');
    assert.equal(result.balance, 900);
  });

  it('should reject debit with insufficient funds', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 50);

    await assert.rejects(
      wallet.debit('p1', 100, 'USD', 'round-1', 'key-1'),
      /Insufficient funds/,
    );
  });

  it('should handle idempotent debits', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 1000);

    await wallet.debit('p1', 100, 'USD', 'round-1', 'key-1');
    // Same key again
    const result = await wallet.debit('p1', 100, 'USD', 'round-1', 'key-1');
    assert.equal(result.balance, 900); // Should not debit twice
  });

  it('should credit successfully', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 1000);

    const result = await wallet.credit('p1', 500, 'USD', 'round-1', 'key-win');
    assert.equal(result.balance, 1500);
  });

  it('should handle idempotent credits', async () => {
    const wallet = new LocalWalletAdapter();
    wallet.setBalance('p1', 1000);

    await wallet.credit('p1', 500, 'USD', 'round-1', 'key-win');
    const result = await wallet.credit('p1', 500, 'USD', 'round-1', 'key-win');
    assert.equal(result.balance, 1500); // Should not credit twice
  });
});
