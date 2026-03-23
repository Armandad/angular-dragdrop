import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AggregatorAdapter } from './aggregator.adapter.js';
import type {
  AggregatorAuthRequest,
  AggregatorBalanceRequest,
  AggregatorBetRequest,
  AggregatorWinRequest,
  AggregatorRollbackRequest,
} from '@slot-engine/shared-types';

/**
 * Aggregator API router — implements the standard seamless wallet callback protocol.
 * Supports multiple aggregator adapters (GCI, SoftSwiss, OpenGaming, etc.)
 */
export class AggregatorRouter {
  private adapters = new Map<string, AggregatorAdapter>();
  private defaultAdapter: AggregatorAdapter | null = null;

  registerAdapter(adapter: AggregatorAdapter, isDefault = false): void {
    this.adapters.set(adapter.name, adapter);
    if (isDefault || !this.defaultAdapter) {
      this.defaultAdapter = adapter;
    }
  }

  private getAdapter(adapterName?: string): AggregatorAdapter {
    if (adapterName) {
      const adapter = this.adapters.get(adapterName);
      if (!adapter) throw new Error(`Unknown aggregator: ${adapterName}`);
      return adapter;
    }
    if (!this.defaultAdapter) throw new Error('No aggregator adapters registered');
    return this.defaultAdapter;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (!path.startsWith('/aggregator/')) return false;

    const adapterName = url.searchParams.get('adapter') ?? undefined;

    try {
      const body = await this.readBody(req);

      switch (path) {
        case '/aggregator/authenticate': {
          const adapter = this.getAdapter(adapterName);
          const result = await adapter.authenticate(body as unknown as AggregatorAuthRequest);
          this.json(res, 200, result);
          return true;
        }

        case '/aggregator/balance': {
          const adapter = this.getAdapter(adapterName);
          const result = await adapter.getBalance(body as unknown as AggregatorBalanceRequest);
          this.json(res, 200, result);
          return true;
        }

        case '/aggregator/bet': {
          const adapter = this.getAdapter(adapterName);
          const betReq = body as unknown as AggregatorBetRequest;
          if (!betReq.idempotencyKey) {
            this.json(res, 400, { error: 'idempotencyKey is required' });
            return true;
          }
          const result = await adapter.placeBet(betReq);
          this.json(res, 200, result);
          return true;
        }

        case '/aggregator/win': {
          const adapter = this.getAdapter(adapterName);
          const winReq = body as unknown as AggregatorWinRequest;
          if (!winReq.idempotencyKey) {
            this.json(res, 400, { error: 'idempotencyKey is required' });
            return true;
          }
          const result = await adapter.creditWin(winReq);
          this.json(res, 200, result);
          return true;
        }

        case '/aggregator/rollback': {
          const adapter = this.getAdapter(adapterName);
          const rollbackReq = body as unknown as AggregatorRollbackRequest;
          if (!rollbackReq.idempotencyKey) {
            this.json(res, 400, { error: 'idempotencyKey is required' });
            return true;
          }
          const result = await adapter.rollback(rollbackReq);
          this.json(res, 200, result);
          return true;
        }

        default:
          this.json(res, 404, { error: 'Unknown aggregator endpoint' });
          return true;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      this.json(res, 500, { error: message });
      return true;
    }
  }

  private json(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString();
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }
}
