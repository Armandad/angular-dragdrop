#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import {
  runSimulation,
  SeededRNG,
  FortunaRNG,
  loadGameDefinition,
} from '@slot-engine/math-engine';
import type { SimulationConfig, SimulationResult } from '@slot-engine/math-engine';

interface SimArgs {
  gameId: string;
  rtpProfile: number;
  totalSpins: number;
  workers: number;
  betPerLine: number;
  activeLines: number;
  seed?: number;
}

function parseArgs(): SimArgs {
  const args = process.argv.slice(2);
  const parsed: SimArgs = {
    gameId: 'shining-crown',
    rtpProfile: 96,
    totalSpins: 1_000_000,
    workers: 1,
    betPerLine: 1,
    activeLines: 10,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--game':
        parsed.gameId = args[++i]!;
        break;
      case '--rtp':
        parsed.rtpProfile = parseInt(args[++i]!, 10);
        break;
      case '--spins':
        parsed.totalSpins = parseInt(args[++i]!, 10);
        break;
      case '--workers':
        parsed.workers = parseInt(args[++i]!, 10);
        break;
      case '--bet':
        parsed.betPerLine = parseInt(args[++i]!, 10);
        break;
      case '--lines':
        parsed.activeLines = parseInt(args[++i]!, 10);
        break;
      case '--seed':
        parsed.seed = parseInt(args[++i]!, 10);
        break;
      case '--help':
        console.log(`
RTP Simulator - Monte Carlo simulation for slot game math verification

Usage:
  rtp-sim [options]

Options:
  --game <id>       Game ID (default: shining-crown)
  --rtp <number>    RTP profile (default: 96)
  --spins <number>  Total spins to simulate (default: 1,000,000)
  --workers <n>     Number of worker threads (default: 1)
  --bet <number>    Bet per line (default: 1)
  --lines <number>  Active lines (default: 10)
  --seed <number>   RNG seed for reproducible results
  --help            Show this help message
`);
        process.exit(0);
    }
  }

  return parsed;
}

async function loadGame(gameId: string) {
  const gamesDir = resolve(
    fileURLToPath(import.meta.url),
    '../../../../..',
    'packages/game-defs/games',
  );

  const gameDir = join(gamesDir, gameId);

  const [configRaw, paytableRaw, paylinesRaw] = await Promise.all([
    readFile(join(gameDir, 'config.json'), 'utf-8'),
    readFile(join(gameDir, 'paytable.json'), 'utf-8'),
    readFile(join(gameDir, 'paylines.json'), 'utf-8'),
  ]);

  const config = JSON.parse(configRaw);
  const paytable = JSON.parse(paytableRaw);
  const paylines = JSON.parse(paylinesRaw);

  // Load all reel strips
  const reelStripSets: Record<number, unknown> = {};
  const reelsDir = join(gameDir, 'reels');
  const reelFiles = await readdir(reelsDir);

  for (const file of reelFiles) {
    const match = file.match(/^base-(\d+)\.json$/);
    if (match) {
      const rtp = parseInt(match[1]!, 10);
      const raw = await readFile(join(reelsDir, file), 'utf-8');
      reelStripSets[rtp] = JSON.parse(raw);
    }
  }

  return loadGameDefinition(config, paytable, paylines, reelStripSets);
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║        RTP Simulator v1.0.0              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log();
  console.log(`Game:        ${args.gameId}`);
  console.log(`RTP Profile: ${args.rtpProfile}%`);
  console.log(`Total Spins: ${args.totalSpins.toLocaleString()}`);
  console.log(`Workers:     ${args.workers}`);
  console.log(`Bet/Line:    ${args.betPerLine}`);
  console.log(`Lines:       ${args.activeLines}`);
  console.log(`Seed:        ${args.seed ?? 'random (CSPRNG)'}`);
  console.log();

  const gameDef = await loadGame(args.gameId);
  const reelStrips = gameDef.reelStrips[args.rtpProfile];

  if (!reelStrips) {
    console.error(`No reel strips for RTP profile ${args.rtpProfile}`);
    const available = Object.keys(gameDef.reelStrips).join(', ');
    console.error(`Available profiles: ${available}`);
    process.exit(1);
  }

  const simConfig: SimulationConfig = {
    totalSpins: args.totalSpins,
    betPerLine: args.betPerLine,
    activeLines: args.activeLines,
    reelStrips,
    rowCount: gameDef.config.rowCount,
    paylines: gameDef.paylines,
    paytable: gameDef.paytable,
    features: gameDef.config.features,
  };

  console.log('Running simulation...');
  const startTime = performance.now();

  const rng = args.seed !== undefined ? new SeededRNG(args.seed) : new FortunaRNG();

  const result = runSimulation(simConfig, rng, (completed, total) => {
    const pct = ((completed / total) * 100).toFixed(1);
    process.stdout.write(`\r  Progress: ${pct}%`);
  });

  const elapsed = performance.now() - startTime;
  console.log('\r  Progress: 100.0%');
  console.log();

  // Results
  console.log('╔══════════════════════════════════════════╗');
  console.log('║              RESULTS                     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  RTP:           ${(result.rtp * 100).toFixed(4)}%`);
  console.log(`║  Hit Rate:      ${(result.hitRate * 100).toFixed(2)}%`);
  console.log(`║  FS Trigger:    ${(result.freeSpinsTriggerRate * 100).toFixed(4)}%`);
  console.log(`║  Max Win:       ${result.maxWin.toLocaleString()}`);
  console.log(`║  Total Bet:     ${result.totalBet.toLocaleString()}`);
  console.log(`║  Total Win:     ${result.totalWin.toLocaleString()}`);
  console.log(`║  Time:          ${(elapsed / 1000).toFixed(2)}s`);
  console.log(
    `║  Speed:         ${((result.totalSpins / elapsed) * 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} spins/sec`,
  );
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Win Distribution:                       ║');
  for (const [bucket, count] of Object.entries(result.winDistribution)) {
    const pct = ((count / result.totalSpins) * 100).toFixed(2);
    const bar = '█'.repeat(Math.floor(parseFloat(pct)));
    console.log(`║    ${bucket.padEnd(8)} ${pct.padStart(6)}%  ${bar}`);
  }
  console.log('╚══════════════════════════════════════════╝');

  // Verdict
  const targetRtp = args.rtpProfile / 100;
  const deviation = Math.abs(result.rtp - targetRtp);
  if (deviation < 0.02) {
    console.log(`\n✓ RTP ${(result.rtp * 100).toFixed(2)}% is within 2% of target ${args.rtpProfile}%`);
  } else {
    console.log(
      `\n✗ RTP ${(result.rtp * 100).toFixed(2)}% deviates ${(deviation * 100).toFixed(2)}% from target ${args.rtpProfile}%`,
    );
    console.log('  Increase spin count or adjust reel strips.');
  }
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
