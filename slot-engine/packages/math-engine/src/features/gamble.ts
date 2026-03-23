import type { CardResult, GambleConfig } from '@slot-engine/shared-types';
import type { IRNG } from '../rng/rng.js';

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const SUIT_COLORS: Record<string, 'red' | 'black'> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
  spades: 'black',
};

export interface GambleResult {
  card: CardResult;
  won: boolean;
  newWinAmount: number;
}

/**
 * Executes a single gamble (double-up) round.
 * Player guesses red/black — correct guess multiplies the win.
 */
export function playGamble(
  currentWin: number,
  choice: 'red' | 'black',
  config: GambleConfig,
  betPerLine: number,
  activeLines: number,
  rng: IRNG,
): GambleResult {
  // Draw a random card (2-14, where 11=J, 12=Q, 13=K, 14=A)
  const suitIndex = rng.nextInt(4);
  const suit = SUITS[suitIndex]!;
  const value = rng.nextInt(13) + 2; // 2-14
  const color = SUIT_COLORS[suit]!;

  const card: CardResult = { suit, value, color };
  const won = choice === color;

  const maxWin = config.maxWinMultiple * betPerLine * activeLines;
  let newWinAmount: number;

  if (won) {
    newWinAmount = Math.min(currentWin * config.multiplier, maxWin);
  } else {
    newWinAmount = 0;
  }

  return { card, won, newWinAmount };
}
