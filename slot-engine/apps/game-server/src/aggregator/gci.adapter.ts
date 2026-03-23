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
 * GCI (Gaming Content Interface) aggregator adapter.
 * Implements the GCI wallet integration protocol used by multiple operators.
 *
 * Required environment variables:
 * - GCI_API_URL: Base URL of the GCI platform API
 * - GCI_OPERATOR_ID: Operator identifier
 * - GCI_SECRET_KEY: Shared secret for request signing
 */
export class GCIAdapter implements AggregatorAdapter {
  readonly name = 'gci';
  private apiUrl: string;
  private operatorId: string;
  private secretKey: string;

  constructor(apiUrl?: string, operatorId?: string, secretKey?: string) {
    this.apiUrl = apiUrl ?? process.env['GCI_API_URL'] ?? '';
    this.operatorId = operatorId ?? process.env['GCI_OPERATOR_ID'] ?? '';
    this.secretKey = secretKey ?? process.env['GCI_SECRET_KEY'] ?? '';

    if (!this.apiUrl || !this.secretKey) {
      console.warn(
        'GCI adapter: GCI_API_URL and GCI_SECRET_KEY required. Running in dry-run mode.',
      );
    }
  }

  async authenticate(req: AggregatorAuthRequest): Promise<AggregatorAuthResponse> {
    const response = await this.request<{
      player_id: string;
      balance: { amount: number; currency: string };
      session_token: string;
    }>('/api/v1/authenticate', {
      token: req.token,
      game_code: req.gameId,
      operator_id: this.operatorId,
      currency: req.currency,
      language: req.language,
    });

    return {
      playerId: response.player_id,
      balance: response.balance.amount,
      currency: response.balance.currency,
      sessionId: response.session_token,
    };
  }

  async getBalance(req: AggregatorBalanceRequest): Promise<AggregatorBalanceResponse> {
    const response = await this.request<{
      balance: number;
      currency: string;
    }>('/api/v1/balance', {
      player_id: req.playerId,
      operator_id: this.operatorId,
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
      ext_transaction_id: string;
    }>('/api/v1/bet', {
      player_id: req.playerId,
      round_id: req.roundId,
      amount: req.amount,
      currency: req.currency,
      transaction_id: req.idempotencyKey,
      operator_id: this.operatorId,
      game_code: 'slot-engine',
      timestamp: new Date().toISOString(),
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
      ext_transaction_id: string;
    }>('/api/v1/win', {
      player_id: req.playerId,
      round_id: req.roundId,
      amount: req.amount,
      currency: req.currency,
      transaction_id: req.idempotencyKey,
      operator_id: this.operatorId,
      game_code: 'slot-engine',
      round_closed: true,
      timestamp: new Date().toISOString(),
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
    }>('/api/v1/rollback', {
      player_id: req.playerId,
      round_id: req.roundId,
      transaction_id: req.idempotencyKey,
      operator_id: this.operatorId,
      game_code: 'slot-engine',
      timestamp: new Date().toISOString(),
    });

    return {
      balance: response.balance,
      currency: response.currency,
    };
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.apiUrl || !this.secretKey) {
      throw new Error('GCI adapter not configured');
    }

    const bodyStr = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const signature = this.sign(`${timestamp}${bodyStr}`);

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GCI-Signature': signature,
        'X-GCI-Timestamp': timestamp,
        'X-GCI-Operator': this.operatorId,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GCI API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }
}
