import type {
  ReelWindow,
  PaylineDef,
  PaytableConfig,
  SymbolId,
  WinLine,
  ScatterWin,
  SpinResult,
  FeatureConfig,
} from '@slot-engine/shared-types';

/**
 * Core line evaluator — evaluates wins left-to-right along paylines
 * with wild substitution. Heart of the EGT-style engine.
 */
export function evaluateLine(
  window: ReelWindow,
  line: PaylineDef,
  lineIndex: number,
  paytable: PaytableConfig,
  betPerLine: number,
): WinLine | null {
  const symbols = line.map((row, reel) => window[reel]![row]!);
  const wildIds = new Set(
    paytable.symbols.filter((s) => s.type === 'wild').map((s) => s.id),
  );

  // Determine the paying symbol — if first symbol is wild, use first non-wild
  let paySymbol: SymbolId = symbols[0]!;
  if (wildIds.has(paySymbol)) {
    const nonWild = symbols.find((s) => !wildIds.has(s));
    if (nonWild !== undefined) {
      paySymbol = nonWild;
    }
  }

  // Count consecutive matching symbols from left
  let count = 0;
  const positions: Array<{ reel: number; row: number }> = [];

  for (let reel = 0; reel < symbols.length; reel++) {
    const sym = symbols[reel]!;
    if (sym === paySymbol || wildIds.has(sym)) {
      count++;
      positions.push({ reel, row: line[reel]! });
    } else {
      break;
    }
  }

  // Look up payout
  const payEntry = paytable.pays[paySymbol];
  const payout = payEntry?.[count];

  if (!payout) return null;

  return {
    lineIndex,
    symbolId: paySymbol,
    count,
    payout: payout * betPerLine,
    positions,
  };
}

/**
 * Evaluates scatter wins — symbols that pay in any position.
 */
export function evaluateScatters(
  window: ReelWindow,
  paytable: PaytableConfig,
  totalBet: number,
  features: FeatureConfig,
): ScatterWin[] {
  const scatterSymbols = paytable.symbols.filter((s) => s.type === 'scatter');
  const wins: ScatterWin[] = [];

  for (const scatterDef of scatterSymbols) {
    const positions: Array<{ reel: number; row: number }> = [];

    for (let reel = 0; reel < window.length; reel++) {
      for (let row = 0; row < window[reel]!.length; row++) {
        if (window[reel]![row] === scatterDef.id) {
          positions.push({ reel, row });
        }
      }
    }

    const count = positions.length;
    if (count < 2) continue;

    // Scatter payout (multiplied by total bet, not per-line)
    const scatterPays = paytable.scatterPays?.[scatterDef.id];
    const payout = (scatterPays?.[count] ?? 0) * totalBet;

    // Check if this triggers free spins
    const triggersFreeSpins =
      features.freeSpins &&
      features.freeSpins.triggerSymbol === scatterDef.id &&
      count >= features.freeSpins.triggerCount;

    if (payout > 0 || triggersFreeSpins) {
      wins.push({
        symbolId: scatterDef.id,
        count,
        payout,
        positions,
        triggeredFeature: triggersFreeSpins ? 'freeSpins' : undefined,
      });
    }
  }

  return wins;
}

/**
 * Applies expanding wilds — wild symbols fill their entire reel.
 */
export function applyExpandingWilds(
  window: ReelWindow,
  paytable: PaytableConfig,
): ReelWindow {
  const wildIds = new Set(
    paytable.symbols
      .filter((s) => s.type === 'wild' && s.expanding)
      .map((s) => s.id),
  );

  if (wildIds.size === 0) return window;

  const expanded: ReelWindow = window.map((col) => [...col]);

  for (let reel = 0; reel < expanded.length; reel++) {
    const col = expanded[reel]!;
    const hasWild = col.some((s) => wildIds.has(s));
    if (hasWild) {
      const wildId = col.find((s) => wildIds.has(s))!;
      for (let row = 0; row < col.length; row++) {
        col[row] = wildId;
      }
    }
  }

  return expanded;
}

/**
 * Full spin evaluation — combines line evaluation, scatters, and expanding wilds.
 */
export function evaluateSpin(
  window: ReelWindow,
  paylines: PaylineDef[],
  paytable: PaytableConfig,
  betPerLine: number,
  activeLines: number,
  features: FeatureConfig,
): SpinResult {
  // Apply expanding wilds if feature is enabled
  const evalWindow = features.expandingWilds
    ? applyExpandingWilds(window, paytable)
    : window;

  // Evaluate each active payline
  const winLines: WinLine[] = [];
  for (let i = 0; i < activeLines; i++) {
    const line = paylines[i];
    if (!line) continue;

    const win = evaluateLine(evalWindow, line, i, paytable, betPerLine);
    if (win) {
      winLines.push(win);
    }
  }

  // Evaluate scatters
  const totalBet = betPerLine * activeLines;
  const scatterWins = evaluateScatters(evalWindow, paytable, totalBet, features);

  // Calculate total win
  const lineWinTotal = winLines.reduce((sum, w) => sum + w.payout, 0);
  const scatterWinTotal = scatterWins.reduce((sum, w) => sum + w.payout, 0);
  const totalWin = lineWinTotal + scatterWinTotal;

  // Free spins awarded
  const freeSpinsAwarded = scatterWins.some((w) => w.triggeredFeature === 'freeSpins')
    ? (features.freeSpins?.spinsAwarded ?? 0)
    : 0;

  return {
    window: evalWindow,
    winLines,
    scatterWins,
    totalWin,
    freeSpinsAwarded,
  };
}
