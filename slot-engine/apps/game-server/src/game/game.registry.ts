import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  loadGameDefinition,
  type GameDefinition,
} from '@slot-engine/math-engine';

/**
 * Auto-discovers and loads game definitions from the game-defs package.
 * Adding a new game = just adding JSON files, zero code changes.
 */
export class GameRegistry {
  private games = new Map<string, GameDefinition>();
  private gamesDir: string;

  constructor(gamesDir?: string) {
    this.gamesDir =
      gamesDir ??
      resolve(
        import.meta.url.replace('file://', ''),
        '../../../../..',
        'packages/game-defs/games',
      );
  }

  async loadGames(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.gamesDir);
    } catch {
      console.warn(`Games directory not found: ${this.gamesDir}`);
      return;
    }

    for (const entry of entries) {
      try {
        await this.loadGame(entry);
      } catch (err) {
        console.error(`Failed to load game "${entry}":`, err);
      }
    }
  }

  private async loadGame(gameId: string): Promise<void> {
    const gameDir = join(this.gamesDir, gameId);

    const [configRaw, paytableRaw, paylinesRaw] = await Promise.all([
      readFile(join(gameDir, 'config.json'), 'utf-8'),
      readFile(join(gameDir, 'paytable.json'), 'utf-8'),
      readFile(join(gameDir, 'paylines.json'), 'utf-8'),
    ]);

    const config = JSON.parse(configRaw);
    const paytable = JSON.parse(paytableRaw);
    const paylines = JSON.parse(paylinesRaw);

    // Load reel strips for each RTP target
    const reelStripSets: Record<number, unknown> = {};
    const rtpTargets: number[] = config.rtpTargets ?? [95, 96, 97];

    for (const rtp of rtpTargets) {
      try {
        const reelsRaw = await readFile(
          join(gameDir, 'reels', `base-${rtp}.json`),
          'utf-8',
        );
        reelStripSets[rtp] = JSON.parse(reelsRaw);
      } catch {
        console.warn(`No reel strips for ${gameId} at RTP ${rtp}`);
      }
    }

    const definition = loadGameDefinition(config, paytable, paylines, reelStripSets);
    this.games.set(gameId, definition);
    console.log(`Loaded game: ${config.name} (${gameId})`);
  }

  getGame(gameId: string): GameDefinition | undefined {
    return this.games.get(gameId);
  }

  getGameIds(): string[] {
    return Array.from(this.games.keys());
  }
}
