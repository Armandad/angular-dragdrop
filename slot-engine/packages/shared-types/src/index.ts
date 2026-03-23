// ─── Symbol Types ───────────────────────────────────────────────
export type SymbolId = number;

export interface SymbolDef {
  id: SymbolId;
  name: string;
  type: 'regular' | 'wild' | 'scatter' | 'bonus';
  /** If true, wild expands to fill entire reel */
  expanding?: boolean;
}

// ─── Reel Types ─────────────────────────────────────────────────
/** A single reel strip: array of symbol IDs */
export type ReelStrip = SymbolId[];

/** The visible window: reels[col][row] */
export type ReelWindow = SymbolId[][];

/** A payline definition: array of row indices, one per reel */
export type PaylineDef = number[];

// ─── Paytable Types ─────────────────────────────────────────────
/** Maps symbol count (3,4,5) to payout multiplier */
export type PayEntry = Partial<Record<number, number>>;

export interface PaytableConfig {
  symbols: SymbolDef[];
  pays: Record<SymbolId, PayEntry>;
  scatterPays?: Record<SymbolId, PayEntry>;
}

// ─── Game Config ────────────────────────────────────────────────
export interface GameConfig {
  gameId: string;
  name: string;
  reelCount: number;
  rowCount: number;
  paylineCount: number;
  denominations: number[];
  defaultDenomination: number;
  minBetLines: number;
  maxBetLines: number;
  features: FeatureConfig;
  rtpTargets: number[];
}

export interface FeatureConfig {
  freeSpins?: FreeSpinsConfig;
  gamble?: GambleConfig;
  expandingWilds?: boolean;
  scatterPay?: boolean;
}

export interface FreeSpinsConfig {
  triggerSymbol: SymbolId;
  triggerCount: number;
  spinsAwarded: number;
  multiplier: number;
  retrigger: boolean;
  maxRetriggers: number;
}

export interface GambleConfig {
  maxAttempts: number;
  /** Multiplier on correct guess (2 = double-up) */
  multiplier: number;
  /** Max win in bet multiples */
  maxWinMultiple: number;
}

// ─── Win Types ──────────────────────────────────────────────────
export interface WinLine {
  lineIndex: number;
  symbolId: SymbolId;
  count: number;
  payout: number;
  positions: Array<{ reel: number; row: number }>;
}

export interface ScatterWin {
  symbolId: SymbolId;
  count: number;
  payout: number;
  positions: Array<{ reel: number; row: number }>;
  triggeredFeature?: 'freeSpins';
}

export interface SpinResult {
  window: ReelWindow;
  winLines: WinLine[];
  scatterWins: ScatterWin[];
  totalWin: number;
  freeSpinsAwarded: number;
}

// ─── Game State ─────────────────────────────────────────────────
export type GameState =
  | 'IDLE'
  | 'SPINNING'
  | 'EVALUATING'
  | 'AWAITING_COLLECT'
  | 'GAMBLE'
  | 'FREE_SPINS'
  | 'COLLECTED';

export interface GameSession {
  sessionId: string;
  playerId: string;
  gameId: string;
  state: GameState;
  balance: number;
  betPerLine: number;
  activeLines: number;
  totalBet: number;
  currentWin: number;
  freeSpinsRemaining: number;
  freeSpinsTotalWin: number;
  gambleAttempts: number;
  roundId: string;
  rtpProfile: number;
}

// ─── API DTOs ───────────────────────────────────────────────────
export interface SpinRequest {
  sessionId: string;
  betPerLine: number;
  activeLines: number;
}

export interface SpinResponse {
  roundId: string;
  result: SpinResult;
  balance: number;
  state: GameState;
  freeSpinsRemaining: number;
}

export interface GambleRequest {
  sessionId: string;
  choice: 'red' | 'black';
}

export interface GambleResponse {
  card: CardResult;
  won: boolean;
  winAmount: number;
  balance: number;
  state: GameState;
  gambleAttemptsRemaining: number;
}

export interface CardResult {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: number;
  color: 'red' | 'black';
}

export interface CollectRequest {
  sessionId: string;
}

export interface CollectResponse {
  collected: number;
  balance: number;
  state: GameState;
}

// ─── Aggregator DTOs ────────────────────────────────────────────
export interface AggregatorAuthRequest {
  token: string;
  gameId: string;
  currency: string;
  language: string;
}

export interface AggregatorAuthResponse {
  playerId: string;
  balance: number;
  currency: string;
  sessionId: string;
}

export interface AggregatorBalanceRequest {
  playerId: string;
  currency: string;
}

export interface AggregatorBetRequest {
  playerId: string;
  roundId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface AggregatorWinRequest {
  playerId: string;
  roundId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface AggregatorRollbackRequest {
  playerId: string;
  roundId: string;
  idempotencyKey: string;
}

export interface AggregatorBalanceResponse {
  balance: number;
  currency: string;
}

// ─── Audit Types ────────────────────────────────────────────────
export interface AuditRound {
  roundId: string;
  playerId: string;
  gameId: string;
  timestamp: number;
  betPerLine: number;
  activeLines: number;
  totalBet: number;
  totalWin: number;
  reelWindow: ReelWindow;
  winLines: WinLine[];
  scatterWins: ScatterWin[];
  freeSpinsAwarded: number;
  gambleResults: GambleResponse[];
  seedHash: string;
  seed: string;
  rtpProfile: number;
}

// ─── Provably Fair ──────────────────────────────────────────────
export interface SeedCommitment {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface SeedReveal {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}
