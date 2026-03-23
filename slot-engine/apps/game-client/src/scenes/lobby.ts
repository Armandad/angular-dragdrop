import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';
import type { ApiClient } from '../core/api-client.js';
import type { GameConfig } from '@slot-engine/shared-types';

/**
 * Game selection lobby — displays available games for the player to choose.
 */
export class LobbyScene implements Scene {
  public container: Container;
  private gameCards: Container[] = [];
  private onGameSelected: (gameId: string) => void;

  constructor(
    private app: Application,
    private apiClient: ApiClient,
    onGameSelected: (gameId: string) => void,
  ) {
    this.container = new Container();
    this.onGameSelected = onGameSelected;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill(0x0d0d1a);
    this.container.addChild(bg);

    // Title
    const title = new Text({
      text: 'SELECT GAME',
      style: {
        fontFamily: 'Arial',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xffd700,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = 400;
    title.y = 30;
    this.container.addChild(title);

    // Load and display games
    this.loadGames();
  }

  private async loadGames(): Promise<void> {
    try {
      const games = await this.apiClient.listGames();
      this.displayGames(games);
    } catch (err) {
      console.error('Failed to load games:', err);
      this.showError('Failed to load games. Is the server running?');
    }
  }

  private displayGames(games: GameConfig[]): void {
    const startX = 50;
    const startY = 100;
    const cardWidth = 220;
    const cardHeight = 300;
    const gap = 25;
    const cols = 3;

    for (let i = 0; i < games.length; i++) {
      const game = games[i]!;
      const col = i % cols;
      const row = Math.floor(i / cols);

      const card = this.createGameCard(
        game,
        startX + col * (cardWidth + gap),
        startY + row * (cardHeight + gap),
        cardWidth,
        cardHeight,
      );
      this.container.addChild(card);
      this.gameCards.push(card);
    }
  }

  private createGameCard(
    game: GameConfig,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Container {
    const card = new Container();
    card.x = x;
    card.y = y;
    card.eventMode = 'static';
    card.cursor = 'pointer';

    // Card background
    const bg = new Graphics();
    bg.roundRect(0, 0, width, height, 12);
    bg.fill(0x1a1a3e);
    bg.stroke({ width: 2, color: 0x333366 });
    card.addChild(bg);

    // Game icon placeholder
    const icon = new Graphics();
    icon.roundRect(20, 20, width - 40, 140, 8);
    icon.fill(this.getGameColor(game.gameId));
    card.addChild(icon);

    // Game icon text
    const iconText = new Text({
      text: this.getGameIcon(game.gameId),
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    iconText.anchor.set(0.5);
    iconText.x = width / 2;
    iconText.y = 90;
    card.addChild(iconText);

    // Game name
    const nameText = new Text({
      text: game.name,
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    nameText.anchor.set(0.5, 0);
    nameText.x = width / 2;
    nameText.y = 175;
    card.addChild(nameText);

    // Game info
    const info = new Text({
      text: `${game.paylineCount} Lines\n${game.reelCount}x${game.rowCount} Reels`,
      style: {
        fontFamily: 'Arial',
        fontSize: 13,
        fill: 0x888888,
        align: 'center',
      },
    });
    info.anchor.set(0.5, 0);
    info.x = width / 2;
    info.y = 200;
    card.addChild(info);

    // Play button
    const playBg = new Graphics();
    playBg.roundRect(30, height - 55, width - 60, 40, 8);
    playBg.fill(0x27ae60);
    card.addChild(playBg);

    const playText = new Text({
      text: 'PLAY',
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    playText.anchor.set(0.5);
    playText.x = width / 2;
    playText.y = height - 35;
    card.addChild(playText);

    // Hover effects
    card.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 12);
      bg.fill(0x222255);
      bg.stroke({ width: 2, color: 0xffd700 });
      card.scale.set(1.02);
    });

    card.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, width, height, 12);
      bg.fill(0x1a1a3e);
      bg.stroke({ width: 2, color: 0x333366 });
      card.scale.set(1);
    });

    card.on('pointerdown', () => {
      this.onGameSelected(game.gameId);
    });

    return card;
  }

  private getGameColor(gameId: string): number {
    const colors: Record<string, number> = {
      'shining-crown': 0x8b6914,
      '20-super-hot': 0xcc3300,
      'burning-hot': 0xff4400,
    };
    return colors[gameId] ?? 0x444488;
  }

  private getGameIcon(gameId: string): string {
    const icons: Record<string, string> = {
      'shining-crown': '\u265B',    // Crown chess symbol
      '20-super-hot': '\u2605',     // Star
      'burning-hot': '\u2600',      // Sun
    };
    return icons[gameId] ?? '\u2666';
  }

  private showError(message: string): void {
    const errText = new Text({
      text: message,
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xff4444,
      },
    });
    errText.anchor.set(0.5);
    errText.x = 400;
    errText.y = 300;
    this.container.addChild(errText);
  }

  onEnter(): void {}
  onExit(): void {}

  onResize(width: number, height: number): void {
    const scale = Math.min(width / 800, height / 600);
    this.container.scale.set(scale);
    this.container.x = (width - 800 * scale) / 2;
    this.container.y = (height - 600 * scale) / 2;
  }
}
