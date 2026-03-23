import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Error types for structured error responses.
 */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export class InsufficientBalanceError extends GameError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      'INSUFFICIENT_BALANCE',
    );
  }
}

export class InvalidStateError extends GameError {
  constructor(action: string, currentState: string) {
    super(
      `Cannot ${action} in state: ${currentState}`,
      'INVALID_STATE',
    );
  }
}

export class SessionNotFoundError extends GameError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', 404);
  }
}

export class GameNotFoundError extends GameError {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`, 'GAME_NOT_FOUND', 404);
  }
}

export class RateLimitError extends GameError {
  constructor() {
    super('Rate limit exceeded', 'RATE_LIMITED', 429);
  }
}

/**
 * Wraps an async request handler with error handling.
 */
export function withErrorHandler(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof GameError) {
        res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message, code: err.code }));
      } else {
        console.error('Unhandled server error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
      }
    }
  };
}
