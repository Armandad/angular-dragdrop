import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';
import type { ApiClient } from '../core/api-client.js';
import type { AudioManager } from '../audio/audio-manager.js';

const CARD_SUITS: Record<string, { symbol: string; color: number }> = {
  hearts: { symbol: '\u2665', color: 0xff4444 },
  diamonds: { symbol: '\u2666', color: 0xff4444 },
  clubs: { symbol: '\u2663', color: 0x222222 },
  spades: { symbol: '\u2660', color: 0x222222 },
};

const CARD_VALUES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/**
 * Gamble (double-up) scene — player guesses red or black to double their win.
 */
export class GambleScene implements Scene {
  public container: Container;
  private cardContainer: Container;
  private cardBack: Graphics;
  private cardFace: Container | null = null;
  private winText: Text;
  private attemptsText: Text;
  private currentWin: number;
  private onComplete: (collected: number) => void;

  constructor(
    private app: Application,
    private apiClient: ApiClient,
    private audioManager: AudioManager,
    currentWin: number,
    onComplete: (collected: number) => void,
  ) {
    this.container = new Container();
    this.currentWin = currentWin;
    this.onComplete = onComplete;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill(0x0a3d0a);
    this.container.addChild(bg);

    // Title
    const title = new Text({
      text: 'GAMBLE - DOUBLE UP',
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffd700,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = 400;
    title.y = 20;
    this.container.addChild(title);

    // Current win display
    this.winText = new Text({
      text: `Win: ${currentWin}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 28,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    this.winText.anchor.set(0.5);
    this.winText.x = 400;
    this.winText.y = 80;
    this.container.addChild(this.winText);

    // Attempts remaining
    this.attemptsText = new Text({
      text: 'Attempts: 5',
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xaaaaaa,
      },
    });
    this.attemptsText.anchor.set(0.5);
    this.attemptsText.x = 400;
    this.attemptsText.y = 110;
    this.container.addChild(this.attemptsText);

    // Card area
    this.cardContainer = new Container();
    this.cardContainer.x = 300;
    this.cardContainer.y = 150;
    this.container.addChild(this.cardContainer);

    // Card back (face down)
    this.cardBack = new Graphics();
    this.cardBack.roundRect(0, 0, 200, 280, 12);
    this.cardBack.fill(0x1a1a8e);
    this.cardBack.roundRect(10, 10, 180, 260, 8);
    this.cardBack.fill(0x2222aa);
    // Diamond pattern on card back
    for (let y = 30; y < 260; y += 30) {
      for (let x = 20; x < 180; x += 30) {
        this.cardBack.rect(x, y, 15, 15);
        this.cardBack.fill(0x1a1a8e);
      }
    }
    this.cardContainer.addChild(this.cardBack);

    // Red button
    this.createChoiceButton('RED', 0xe74c3c, 120, 470, 'red');

    // Black button
    this.createChoiceButton('BLACK', 0x2c3e50, 440, 470, 'black');

    // Collect button
    this.createCollectButton();

    // History display
    const historyLabel = new Text({
      text: 'Previous cards:',
      style: { fontFamily: 'Arial', fontSize: 14, fill: 0x888888 },
    });
    historyLabel.x = 20;
    historyLabel.y = 560;
    this.container.addChild(historyLabel);
  }

  private createChoiceButton(
    label: string,
    color: number,
    x: number,
    y: number,
    choice: 'red' | 'black',
  ): void {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.x = x;
    btn.y = y;

    const bg = new Graphics();
    bg.roundRect(0, 0, 200, 60, 12);
    bg.fill(color);
    btn.addChild(bg);

    const text = new Text({
      text: label,
      style: {
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    text.anchor.set(0.5);
    text.x = 100;
    text.y = 30;
    btn.addChild(text);

    btn.on('pointerdown', () => this.onChoice(choice));
    btn.on('pointerover', () => { bg.alpha = 0.8; });
    btn.on('pointerout', () => { bg.alpha = 1; });

    this.container.addChild(btn);
  }

  private createCollectButton(): void {
    const btn = new Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.x = 300;
    btn.y = 470;

    const bg = new Graphics();
    bg.roundRect(0, 0, 160, 60, 12);
    bg.fill(0x27ae60);
    btn.addChild(bg);

    const text = new Text({
      text: 'COLLECT',
      style: {
        fontFamily: 'Arial',
        fontSize: 22,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    text.anchor.set(0.5);
    text.x = 80;
    text.y = 30;
    btn.addChild(text);

    btn.on('pointerdown', () => this.onCollectClick());
    this.container.addChild(btn);
  }

  private async onChoice(choice: 'red' | 'black'): Promise<void> {
    this.audioManager.playClick();

    try {
      const response = await this.apiClient.gamble(choice);

      // Reveal the card
      this.revealCard(response.card.suit, response.card.value);

      if (response.won) {
        this.currentWin = response.winAmount;
        this.winText.text = `Win: ${this.currentWin}`;
        this.attemptsText.text = `Attempts: ${response.gambleAttemptsRemaining}`;
        this.audioManager.playWin(false);
      } else {
        this.winText.text = 'LOST!';
        this.winText.style.fill = 0xff4444;
        this.audioManager.playClick();

        // Return to main game after delay
        setTimeout(() => {
          this.onComplete(0);
        }, 1500);
      }

      // Auto-collect if no attempts left
      if (response.gambleAttemptsRemaining <= 0 && response.won) {
        setTimeout(() => {
          this.onCollectClick();
        }, 1000);
      }
    } catch (err) {
      console.error('Gamble failed:', err);
    }
  }

  private revealCard(suit: string, value: number): void {
    // Remove card back
    this.cardBack.visible = false;

    // Remove previous face
    if (this.cardFace) {
      this.cardContainer.removeChild(this.cardFace);
    }

    // Create card face
    this.cardFace = new Container();

    const face = new Graphics();
    face.roundRect(0, 0, 200, 280, 12);
    face.fill(0xffffff);
    this.cardFace.addChild(face);

    const suitInfo = CARD_SUITS[suit] ?? { symbol: '?', color: 0x000000 };
    const valueStr = CARD_VALUES[value] ?? '?';

    // Value + suit top-left
    const topText = new Text({
      text: `${valueStr}\n${suitInfo.symbol}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'bold',
        fill: suitInfo.color,
        align: 'center',
      },
    });
    topText.x = 15;
    topText.y = 10;
    this.cardFace.addChild(topText);

    // Large center suit
    const centerSuit = new Text({
      text: suitInfo.symbol,
      style: {
        fontFamily: 'Arial',
        fontSize: 80,
        fill: suitInfo.color,
      },
    });
    centerSuit.anchor.set(0.5);
    centerSuit.x = 100;
    centerSuit.y = 140;
    this.cardFace.addChild(centerSuit);

    this.cardContainer.addChild(this.cardFace);

    // Reset card back for next round (after a delay)
    setTimeout(() => {
      this.cardBack.visible = true;
      if (this.cardFace) {
        this.cardContainer.removeChild(this.cardFace);
        this.cardFace = null;
      }
    }, 1200);
  }

  private async onCollectClick(): Promise<void> {
    try {
      await this.apiClient.collect();
      this.onComplete(this.currentWin);
    } catch (err) {
      console.error('Collect failed:', err);
      this.onComplete(this.currentWin);
    }
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
