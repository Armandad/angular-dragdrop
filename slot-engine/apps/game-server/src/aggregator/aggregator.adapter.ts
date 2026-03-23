import type {
  AggregatorAuthRequest,
  AggregatorAuthResponse,
  AggregatorBalanceRequest,
  AggregatorBalanceResponse,
  AggregatorBetRequest,
  AggregatorWinRequest,
  AggregatorRollbackRequest,
} from '@slot-engine/shared-types';

/**
 * Aggregator adapter interface — plug in GCI, SoftSwiss, OpenGaming, or custom protocols.
 */
export interface AggregatorAdapter {
  readonly name: string;

  authenticate(req: AggregatorAuthRequest): Promise<AggregatorAuthResponse>;
  getBalance(req: AggregatorBalanceRequest): Promise<AggregatorBalanceResponse>;
  placeBet(req: AggregatorBetRequest): Promise<AggregatorBalanceResponse>;
  creditWin(req: AggregatorWinRequest): Promise<AggregatorBalanceResponse>;
  rollback(req: AggregatorRollbackRequest): Promise<AggregatorBalanceResponse>;
}

/**
 * Mock aggregator for local development.
 */
export class MockAggregatorAdapter implements AggregatorAdapter {
  readonly name = 'mock';
  private balances = new Map<string, number>();

  async authenticate(req: AggregatorAuthRequest): Promise<AggregatorAuthResponse> {
    const playerId = `player_${req.token.substring(0, 8)}`;
    this.balances.set(playerId, 100_000);
    return {
      playerId,
      balance: 100_000,
      currency: req.currency,
      sessionId: `session_${Date.now()}`,
    };
  }

  async getBalance(req: AggregatorBalanceRequest): Promise<AggregatorBalanceResponse> {
    return {
      balance: this.balances.get(req.playerId) ?? 0,
      currency: req.currency,
    };
  }

  async placeBet(req: AggregatorBetRequest): Promise<AggregatorBalanceResponse> {
    const bal = this.balances.get(req.playerId) ?? 0;
    if (bal < req.amount) throw new Error('Insufficient funds');
    const newBal = bal - req.amount;
    this.balances.set(req.playerId, newBal);
    return { balance: newBal, currency: req.currency };
  }

  async creditWin(req: AggregatorWinRequest): Promise<AggregatorBalanceResponse> {
    const bal = this.balances.get(req.playerId) ?? 0;
    const newBal = bal + req.amount;
    this.balances.set(req.playerId, newBal);
    return { balance: newBal, currency: req.currency };
  }

  async rollback(req: AggregatorRollbackRequest): Promise<AggregatorBalanceResponse> {
    return {
      balance: this.balances.get(req.playerId) ?? 0,
      currency: 'USD',
    };
  }
}
