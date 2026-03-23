/**
 * Wallet adapter interface — supports seamless and transfer protocols.
 */
export interface WalletAdapter {
  /** Get player balance */
  getBalance(playerId: string, currency: string): Promise<number>;

  /** Debit bet amount with idempotency */
  debit(
    playerId: string,
    amount: number,
    currency: string,
    roundId: string,
    idempotencyKey: string,
  ): Promise<{ balance: number; transactionId: string }>;

  /** Credit win amount with idempotency */
  credit(
    playerId: string,
    amount: number,
    currency: string,
    roundId: string,
    idempotencyKey: string,
  ): Promise<{ balance: number; transactionId: string }>;

  /** Rollback a failed transaction */
  rollback(
    playerId: string,
    roundId: string,
    idempotencyKey: string,
  ): Promise<{ balance: number }>;
}

/**
 * Local in-memory wallet for development/testing.
 */
export class LocalWalletAdapter implements WalletAdapter {
  private balances = new Map<string, number>();
  private processedKeys = new Set<string>();

  setBalance(playerId: string, balance: number): void {
    this.balances.set(playerId, balance);
  }

  async getBalance(playerId: string): Promise<number> {
    return this.balances.get(playerId) ?? 0;
  }

  async debit(
    playerId: string,
    amount: number,
    _currency: string,
    _roundId: string,
    idempotencyKey: string,
  ): Promise<{ balance: number; transactionId: string }> {
    // Idempotency check
    if (this.processedKeys.has(idempotencyKey)) {
      return {
        balance: this.balances.get(playerId) ?? 0,
        transactionId: idempotencyKey,
      };
    }

    const balance = this.balances.get(playerId) ?? 0;
    if (balance < amount) {
      throw new Error('Insufficient funds');
    }

    const newBalance = balance - amount;
    this.balances.set(playerId, newBalance);
    this.processedKeys.add(idempotencyKey);

    return { balance: newBalance, transactionId: idempotencyKey };
  }

  async credit(
    playerId: string,
    amount: number,
    _currency: string,
    _roundId: string,
    idempotencyKey: string,
  ): Promise<{ balance: number; transactionId: string }> {
    if (this.processedKeys.has(idempotencyKey)) {
      return {
        balance: this.balances.get(playerId) ?? 0,
        transactionId: idempotencyKey,
      };
    }

    const balance = this.balances.get(playerId) ?? 0;
    const newBalance = balance + amount;
    this.balances.set(playerId, newBalance);
    this.processedKeys.add(idempotencyKey);

    return { balance: newBalance, transactionId: idempotencyKey };
  }

  async rollback(
    playerId: string,
    _roundId: string,
    _idempotencyKey: string,
  ): Promise<{ balance: number }> {
    return { balance: this.balances.get(playerId) ?? 0 };
  }
}
