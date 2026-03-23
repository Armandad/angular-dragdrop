import type {
  AggregatorAuthRequest,
  AggregatorAuthResponse,
  AggregatorBalanceRequest,
  AggregatorBalanceResponse,
  AggregatorBetRequest,
  AggregatorWinRequest,
  AggregatorRollbackRequest,
} from '@slot-engine/shared-types';
import type { AggregatorAdapter } from './aggregator.adapter.js';
import { createHmac } from 'node:crypto';

/**
 * SoftSwiss aggregator adapter.
 * Implements the SoftSwiss Game Aggregation API protocol.
 *
 * Required environment variables:
 * - SOFTSWISS_API_URL: Base URL of the SoftSwiss API
 * - SOFTSWISS_API_KEY: API key for HMAC signature
 */
export class SoftSwissAdapter implements AggregatorAdapter {
  readonly name = 'softswiss';
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl ?? process.env['SOFTSWISS_API_URL'] ?? '';
    this.apiKey = apiKey ?? process.env['SOFTSWISS_API_KEY'] ?? '';

    if (!this.apiUrl || !this.apiKey) {
      console.warn(
        'SoftSwiss adapter: SOFTSWISS_API_URL and SOFTSWISS_API_KEY required. Running in dry-run mode.',
      );
    }
  }

  async authenticate(req: AggregatorAuthRequest): Promise<AggregatorAuthResponse> {
    const response = await this.request<{
      user_id: string;
      balance: number;
      currency: string;
    }>('/sessions/validate', {
      game_token: req.token,
      game_id: req.gameId,
      currency: req.currency,
      locale: req.language,
    });

    return {
      playerId: response.user_id,
      balance: response.balance,
      currency: response.currency,
      sessionId: `ss_${Date.now()}_${response.user_id}`,
    };
  }

  async getBalance(req: AggregatorBalanceRequest): Promise<AggregatorBalanceResponse> {
    const response = await this.request<{
      balance: number;
      currency: string;
    }>('/wallet/balance', {
      user_id: req.playerId,
      currency: req.currency,
    });

    return {
      balance: response.balance,
      currency: response.currency,
    };
  }

  async placeBet(req: AggregatorBetRequest): Promise<AggregatorBalanceResponse> {
    const response = await this.request<{
      balance: number;
      currency: string;
      transaction_id: string;
    }>('/wallet/bet', {
      user_id: req.playerId,
      round_id: req.roundId,
      amount: req.amount,
      currency: req.currency,
      transaction_id: req.idempotencyKey,
      game_id: 'slot-engine',
    });

    return {
      balance: response.balance,
      currency: response.currency,
    };
  }

  async creditWin(req: AggregatorWinRequest): Promise<AggregatorBalanceResponse> {
    const response = await this.request<{
      balance: number;
      currency: string;
      transaction_id: string;
    }>('/wallet/win', {
      user_id: req.playerId,
      round_id: req.roundId,
      amount: req.amount,
      currency: req.currency,
      transaction_id: req.idempotencyKey,
      game_id: 'slot-engine',
      is_round_finished: true,
    });

    return {
      balance: response.balance,
      currency: response.currency,
    };
  }

  async rollback(req: AggregatorRollbackRequest): Promise<AggregatorBalanceResponse> {
    const response = await this.request<{
      balance: number;
      currency: string;
    }>('/wallet/rollback', {
      user_id: req.playerId,
      round_id: req.roundId,
      transaction_id: req.idempotencyKey,
      game_id: 'slot-engine',
    });

    return {
      balance: response.balance,
      currency: response.currency,
    };
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('SoftSwiss adapter not configured');
    }

    const bodyStr = JSON.stringify(body);
    const signature = this.sign(bodyStr);

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SoftSwiss API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.apiKey).update(body).digest('hex');
  }
}
