import type {
  GameConfig,
  PaytableConfig,
  PaylineDef,
  ReelStrip,
} from '@slot-engine/shared-types';

/**
 * Loaded game definition — everything needed to run the math engine.
 */
export interface GameDefinition {
  config: GameConfig;
  paytable: PaytableConfig;
  paylines: PaylineDef[];
  reelStrips: Record<number, ReelStrip[]>; // keyed by RTP target (e.g., 95, 96, 97)
}

/**
 * Validates a game config object. Throws on invalid structure.
 */
export function validateGameConfig(config: unknown): config is GameConfig {
  const c = config as Record<string, unknown>;
  if (!c || typeof c !== 'object') throw new Error('Config must be an object');
  if (typeof c['gameId'] !== 'string') throw new Error('gameId must be a string');
  if (typeof c['name'] !== 'string') throw new Error('name must be a string');
  if (typeof c['reelCount'] !== 'number' || (c['reelCount'] as number) < 3)
    throw new Error('reelCount must be >= 3');
  if (typeof c['rowCount'] !== 'number' || (c['rowCount'] as number) < 1)
    throw new Error('rowCount must be >= 1');
  if (!Array.isArray(c['denominations']) || (c['denominations'] as unknown[]).length === 0)
    throw new Error('denominations must be a non-empty array');
  return true;
}

/**
 * Validates a paytable configuration.
 */
export function validatePaytable(paytable: unknown): paytable is PaytableConfig {
  const p = paytable as Record<string, unknown>;
  if (!p || typeof p !== 'object') throw new Error('Paytable must be an object');
  if (!Array.isArray(p['symbols']) || (p['symbols'] as unknown[]).length === 0)
    throw new Error('symbols must be a non-empty array');
  if (!p['pays'] || typeof p['pays'] !== 'object')
    throw new Error('pays must be an object');
  return true;
}

/**
 * Validates payline definitions.
 */
export function validatePaylines(
  paylines: unknown,
  reelCount: number,
  rowCount: number,
): paylines is PaylineDef[] {
  if (!Array.isArray(paylines)) throw new Error('Paylines must be an array');
  for (let i = 0; i < (paylines as unknown[][]).length; i++) {
    const line = (paylines as number[][])[i]!;
    if (line.length !== reelCount)
      throw new Error(`Payline ${i} must have ${reelCount} positions`);
    for (const pos of line) {
      if (pos < 0 || pos >= rowCount)
        throw new Error(`Payline ${i} has invalid row index ${pos}`);
    }
  }
  return true;
}

/**
 * Validates reel strips.
 */
export function validateReelStrips(
  strips: unknown,
  reelCount: number,
): strips is ReelStrip[] {
  if (!Array.isArray(strips)) throw new Error('Reel strips must be an array');
  if ((strips as unknown[]).length !== reelCount)
    throw new Error(`Expected ${reelCount} reel strips`);
  for (let i = 0; i < (strips as unknown[]).length; i++) {
    const strip = (strips as number[][])[i]!;
    if (!Array.isArray(strip) || strip.length < 10)
      throw new Error(`Reel strip ${i} must have at least 10 symbols`);
  }
  return true;
}

/**
 * Creates a GameDefinition from raw JSON data.
 */
export function loadGameDefinition(
  config: unknown,
  paytable: unknown,
  paylines: unknown,
  reelStripSets: Record<number, unknown>,
): GameDefinition {
  validateGameConfig(config);
  validatePaytable(paytable);
  validatePaylines(paylines, config.reelCount, config.rowCount);

  const validatedStrips: Record<number, ReelStrip[]> = {};
  for (const [rtp, strips] of Object.entries(reelStripSets)) {
    validateReelStrips(strips, config.reelCount);
    validatedStrips[Number(rtp)] = strips as ReelStrip[];
  }

  return {
    config,
    paytable: paytable as PaytableConfig,
    paylines: paylines as PaylineDef[],
    reelStrips: validatedStrips,
  };
}
