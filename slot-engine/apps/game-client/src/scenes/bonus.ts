import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';
import type { AudioManager } from '../audio/audio-manager.js';
import type { SpinResult } from '@slot-engine/shared-types';

/**
 * Bonus/Free Spins scene — displays the free spins intro and tracks progress.
 */
export class BonusScene implements Scene {
  public container: Container;
  private spinsText: Text;
  private totalWinText: Text;
  private spinCountText: Text;
  private spinsRemaining: number;
  private totalSpins: number;
  private totalWin = 0;
  private spinCount = 0;

  constructor(
    private app: Application,
    private audioManager: AudioManager,
    spinsAwarded: number,
    private multiplier: number,
    private onComplete: (totalWin: number) => void,
  ) {
    this.container = new Container();
    this.spinsRemaining = spinsAwarded;
    this.totalSpins = spinsAwarded;

    // Background with bonus theme
    const bg = new Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill(0x1a0a2e);
    this.container.addChild(bg);

    // Stars background decoration
    for (let i = 0; i < 50; i++) {
      const star = new Graphics();
      star.circle(0, 0, 1 + Math.random() * 2);
      star.fill(0xffd700);
      star.x = Math.random() * 800;
      star.y = Math.random() * 300;
      star.alpha = 0.3 + Math.random() * 0.7;
      this.container.addChild(star);
    }

    // Title banner
    const banner = new Graphics();
    banner.roundRect(100, 20, 600, 80, 10);
    banner.fill(0xffd700);
    this.container.addChild(banner);

    const title = new Text({
      text: 'FREE SPINS!',
      style: {
        fontFamily: 'Arial',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0x1a0a2e,
      },
    });
    title.anchor.set(0.5);
    title.x = 400;
    title.y = 60;
    this.container.addChild(title);

    // Spins awarded
    this.spinsText = new Text({
      text: `${spinsAwarded} FREE SPINS AWARDED`,
      style: {
        fontFamily: 'Arial',
        fontSize: 28,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    this.spinsText.anchor.set(0.5);
    this.spinsText.x = 400;
    this.spinsText.y = 140;
    this.container.addChild(this.spinsText);

    // Multiplier display
    if (multiplier > 1) {
      const multText = new Text({
        text: `All wins x${multiplier}!`,
        style: {
          fontFamily: 'Arial',
          fontSize: 24,
          fontWeight: 'bold',
          fill: 0xff6b6b,
        },
      });
      multText.anchor.set(0.5);
      multText.x = 400;
      multText.y = 180;
      this.container.addChild(multText);
    }

    // Spin counter
    this.spinCountText = new Text({
      text: `Spin: 0 / ${this.totalSpins}`,
      style: {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xaaaaaa,
      },
    });
    this.spinCountText.anchor.set(0.5);
    this.spinCountText.x = 400;
    this.spinCountText.y = 450;
    this.container.addChild(this.spinCountText);

    // Total win display
    const winLabel = new Text({
      text: 'TOTAL WIN',
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0x888888,
      },
    });
    winLabel.anchor.set(0.5);
    winLabel.x = 400;
    winLabel.y = 490;
    this.container.addChild(winLabel);

    this.totalWinText = new Text({
      text: '0',
      style: {
        fontFamily: 'Arial',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xffd700,
      },
    });
    this.totalWinText.anchor.set(0.5);
    this.totalWinText.x = 400;
    this.totalWinText.y = 530;
    this.container.addChild(this.totalWinText);
  }

  /**
   * Called after each free spin result is received.
   */
  addSpinResult(result: SpinResult, retriggerSpins?: number): void {
    this.spinCount++;
    this.spinsRemaining--;
    this.totalWin += result.totalWin;

    this.spinCountText.text = `Spin: ${this.spinCount} / ${this.totalSpins}`;
    this.totalWinText.text = this.totalWin.toLocaleString();

    if (result.totalWin > 0) {
      this.audioManager.playWin(result.totalWin > 100);
      // Pulse animation on win
      this.totalWinText.scale.set(1.3);
      const shrink = (): void => {
        if (this.totalWinText.scale.x > 1) {
          this.totalWinText.scale.set(this.totalWinText.scale.x - 0.02);
          requestAnimationFrame(shrink);
        } else {
          this.totalWinText.scale.set(1);
        }
      };
      requestAnimationFrame(shrink);
    }

    // Handle retrigger
    if (retriggerSpins && retriggerSpins > 0) {
      this.totalSpins += retriggerSpins;
      this.spinsRemaining += retriggerSpins;
      this.spinsText.text = `RETRIGGERED! +${retriggerSpins} SPINS`;

      setTimeout(() => {
        this.spinsText.text = `${this.spinsRemaining} SPINS REMAINING`;
      }, 2000);
    }

    // Check completion
    if (this.spinsRemaining <= 0) {
      this.spinsText.text = 'FREE SPINS COMPLETE!';
      setTimeout(() => {
        this.onComplete(this.totalWin);
      }, 2000);
    }
  }

  onEnter(): void {
    this.audioManager.playWin(true);
  }

  onExit(): void {}

  onResize(width: number, height: number): void {
    const scale = Math.min(width / 800, height / 600);
    this.container.scale.set(scale);
    this.container.x = (width - 800 * scale) / 2;
    this.container.y = (height - 600 * scale) / 2;
  }
}
