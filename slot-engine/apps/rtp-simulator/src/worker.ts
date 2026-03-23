import { parentPort, workerData } from 'node:worker_threads';
import { runSimulation, SeededRNG, FortunaRNG } from '@slot-engine/math-engine';
import type { SimulationConfig, SimulationResult } from '@slot-engine/math-engine';

interface WorkerInput {
  config: SimulationConfig;
  seed?: number;
  workerId: number;
}

if (parentPort) {
  const input = workerData as WorkerInput;

  // Each worker uses a different seed derived from worker ID
  const rng = input.seed !== undefined
    ? new SeededRNG(input.seed + input.workerId * 1000000)
    : new FortunaRNG();

  const result = runSimulation(input.config, rng, (completed, total) => {
    // Report progress to parent
    parentPort!.postMessage({
      type: 'progress',
      workerId: input.workerId,
      completed,
      total,
    });
  });

  parentPort.postMessage({ type: 'result', workerId: input.workerId, result });
}
