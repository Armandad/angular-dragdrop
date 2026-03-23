// RNG
export { FortunaRNG, SeededRNG } from './rng/rng.js';
export type { IRNG } from './rng/rng.js';

// Reels
export { spinReels, extractWindow } from './reels/reels.js';

// Evaluator
export {
  evaluateLine,
  evaluateScatters,
  applyExpandingWilds,
  evaluateSpin,
} from './evaluator/evaluator.js';

// Features
export { playFreeSpins } from './features/free-spins.js';
export type { FreeSpinsResult } from './features/free-spins.js';
export { playGamble } from './features/gamble.js';
export type { GambleResult } from './features/gamble.js';

// Simulation
export { runSimulation } from './simulation/simulator.js';
export type { SimulationConfig, SimulationResult } from './simulation/simulator.js';

// Config
export {
  loadGameDefinition,
  validateGameConfig,
  validatePaytable,
  validatePaylines,
  validateReelStrips,
} from './config/loader.js';
export type { GameDefinition } from './config/loader.js';
