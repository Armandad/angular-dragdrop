import type {
  SpinResponse,
  GambleResponse,
  CollectResponse,
  GameSession,
  GameConfig,
} from '@slot-engine/shared-types';

export class ApiClient {
  private baseUrl: string;
  private sessionId: string = '';
  private balance: number = 0;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async createSession(
    playerId: string,
    gameId: string,
    rtpProfile = 96,
    initialBalance = 10000,
  ): Promise<GameSession> {
    const res = await this.post<GameSession>('/api/session', {
      playerId,
      gameId,
      rtpProfile,
      initialBalance,
    });
    this.sessionId = res.sessionId;
    this.balance = res.balance;
    return res;
  }

  async spin(betPerLine: number, activeLines: number): Promise<SpinResponse> {
    const res = await this.post<SpinResponse>('/api/spin', {
      sessionId: this.sessionId,
      betPerLine,
      activeLines,
    });
    this.balance = res.balance;
    return res;
  }

  async gamble(choice: 'red' | 'black'): Promise<GambleResponse> {
    const res = await this.post<GambleResponse>('/api/gamble', {
      sessionId: this.sessionId,
      choice,
    });
    this.balance = res.balance;
    return res;
  }

  async collect(): Promise<CollectResponse> {
    const res = await this.post<CollectResponse>('/api/collect', {
      sessionId: this.sessionId,
    });
    this.balance = res.balance;
    return res;
  }

  async listGames(): Promise<GameConfig[]> {
    const res = await this.get<{ games: GameConfig[] }>('/api/games');
    return res.games;
  }

  getBalance(): number {
    return this.balance;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }
}
