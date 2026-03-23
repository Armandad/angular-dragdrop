import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { SimulationConfig, SimulationResult } from '@slot-engine/math-engine';

interface WorkerMessage {
  type: 'progress' | 'result';
  workerId: number;
  completed?: number;
  total?: number;
  result?: SimulationResult;
}

/**
 * Runs the RTP simulation in parallel across multiple worker threads.
 * Splits total spins evenly among workers, then aggregates results.
 */
export async function runParallelSimulation(
  config: SimulationConfig,
  workerCount: number,
  seed?: number,
  onProgress?: (totalCompleted: number, totalSpins: number) => void,
): Promise<SimulationResult> {
  const spinsPerWorker = Math.ceil(config.totalSpins / workerCount);
  const startTime = performance.now();

  const workerPath = join(
    dirname(fileURLToPath(import.meta.url)),
    'worker.js',
  );

  const workerProgress = new Map<number, number>();
  const results: SimulationResult[] = [];

  const workerPromises = Array.from({ length: workerCount }, (_, i) => {
    return new Promise<SimulationResult>((resolve, reject) => {
      // Last worker gets remaining spins
      const workerSpins = i === workerCount - 1
        ? config.totalSpins - spinsPerWorker * (workerCount - 1)
        : spinsPerWorker;

      const workerConfig: SimulationConfig = {
        ...config,
        totalSpins: workerSpins,
      };

      const worker = new Worker(workerPath, {
        workerData: {
          config: workerConfig,
          seed,
          workerId: i,
        },
      });

      worker.on('message', (msg: WorkerMessage) => {
        if (msg.type === 'progress') {
          workerProgress.set(msg.workerId, msg.completed ?? 0);
          if (onProgress) {
            let totalCompleted = 0;
            for (const v of workerProgress.values()) totalCompleted += v;
            onProgress(totalCompleted, config.totalSpins);
          }
        } else if (msg.type === 'result' && msg.result) {
          resolve(msg.result);
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker ${i} exited with code ${code}`));
        }
      });
    });
  });

  const workerResults = await Promise.all(workerPromises);
  const elapsed = performance.now() - startTime;

  // Aggregate results
  return aggregateResults(workerResults, config.totalSpins, elapsed);
}

function aggregateResults(
  results: SimulationResult[],
  totalSpins: number,
  elapsedMs: number,
): SimulationResult {
  let totalBet = 0;
  let totalWin = 0;
  let maxWin = 0;
  let totalHits = 0;
  let totalFsTriggers = 0;

  const distribution: Record<string, number> = {
    '0x': 0, '1-2x': 0, '2-5x': 0, '5-10x': 0,
    '10-50x': 0, '50-100x': 0, '100x+': 0,
  };

  for (const r of results) {
    totalBet += r.totalBet;
    totalWin += r.totalWin;
    if (r.maxWin > maxWin) maxWin = r.maxWin;
    totalHits += r.hitRate * r.totalSpins;
    totalFsTriggers += r.freeSpinsTriggerRate * r.totalSpins;

    for (const [bucket, count] of Object.entries(r.winDistribution)) {
      distribution[bucket] = (distribution[bucket] ?? 0) + count;
    }
  }

  return {
    totalSpins,
    totalBet,
    totalWin,
    rtp: totalWin / totalBet,
    hitRate: totalHits / totalSpins,
    freeSpinsTriggerRate: totalFsTriggers / totalSpins,
    maxWin,
    winDistribution: distribution,
    elapsedMs,
  };
}
