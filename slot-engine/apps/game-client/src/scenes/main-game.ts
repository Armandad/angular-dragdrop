import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';
import type { ApiClient } from '../core/api-client.js';
import type { AudioManager } from '../audio/audio-manager.js';
import { ReelStrip } from '../components/reel/reel-strip.js';
import { SpinButton } from '../components/ui/spin-button.js';
import { BetSelector } from '../components/ui/bet-selector.js';
import { WinDisplay } from '../components/ui/win-display.js';
import { WinParticles } from '../components/effects/particles.js';

const REEL_COUNT = 5;
const ROW_COUNT = 3;
const SYMBOL_SIZE = 120;
const REEL_GAP = 10;

export class MainGameScene implements Scene {
  public container: Container;
  private reels: ReelStrip[] = [];
  private spinButton: SpinButton;
  private betSelector: BetSelector;
  private winDisplay: WinDisplay;
  private particles: WinParticles;
  private reelContainer: Container;
  private spinning = false;

  constructor(
    private app: Application,
    private apiClient: ApiClient,
    private audioManager: AudioManager,
  ) {
    this.container = new Container();

    // Title
    const title = new Text({
      text: 'SHINING CROWN',
      style: {
        fontFamily: 'Arial',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xffd700,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = 400;
    title.y = 20;
    this.container.addChild(title);

    // Reel background
    const reelBg = new Graphics();
    const totalWidth = REEL_COUNT * (SYMBOL_SIZE + REEL_GAP) - REEL_GAP + 20;
    const totalHeight = ROW_COUNT * SYMBOL_SIZE + 20;
    reelBg.roundRect(0, 0, totalWidth, totalHeight, 10);
    reelBg.fill(0x111122);
    reelBg.stroke({ width: 2, color: 0x333366 });
    reelBg.x = (800 - totalWidth) / 2;
    reelBg.y = 80;
    this.container.addChild(reelBg);

    // Create reels
    this.reelContainer = new Container();
    this.reelContainer.x = reelBg.x + 10;
    this.reelContainer.y = reelBg.y + 10;

    for (let i = 0; i < REEL_COUNT; i++) {
      const reel = new ReelStrip(i, ROW_COUNT);
      reel.container.x = i * (SYMBOL_SIZE + REEL_GAP);
      this.reels.push(reel);
      this.reelContainer.addChild(reel.container);
    }
    this.container.addChild(this.reelContainer);

    // Particles effect
    this.particles = new WinParticles();
    this.container.addChild(this.particles.container);

    // Win display
    this.winDisplay = new WinDisplay();
    this.winDisplay.container.x = 200;
    this.winDisplay.container.y = 470;
    this.container.addChild(this.winDisplay.container);

    // Bet selector
    this.betSelector = new BetSelector([1, 2, 5, 10, 20, 50, 100], 10);
    this.betSelector.container.x = 100;
    this.betSelector.container.y = 530;
    this.container.addChild(this.betSelector.container);

    // Spin button
    this.spinButton = new SpinButton(() => this.onSpin());
    this.spinButton.container.x = 600;
    this.spinButton.container.y = 530;
    this.container.addChild(this.spinButton.container);

    // Gamble buttons
    this.createGambleButtons();

    // Update loop
    this.app.ticker.add(() => this.update());
  }

  private createGambleButtons(): void {
    // Collect button
    const collectBtn = new Container();
    collectBtn.eventMode = 'static';
    collectBtn.cursor = 'pointer';
    collectBtn.x = 450;
    collectBtn.y = 530;

    const collectBg = new Graphics();
    collectBg.roundRect(0, 0, 120, 40, 8);
    collectBg.fill(0x2980b9);
    collectBtn.addChild(collectBg);

    const collectText = new Text({
      text: 'COLLECT',
      style: { fontFamily: 'Arial', fontSize: 16, fontWeight: 'bold', fill: 0xffffff },
    });
    collectText.anchor.set(0.5);
    collectText.x = 60;
    collectText.y = 20;
    collectBtn.addChild(collectText);

    collectBtn.on('pointerdown', () => this.onCollect());
    this.container.addChild(collectBtn);
  }

  private async onSpin(): Promise<void> {
    if (this.spinning) return;
    this.spinning = true;
    this.spinButton.setEnabled(false);
    this.winDisplay.setWin(0);
    this.particles.clear();
    this.audioManager.playSpin();

    // Start all reels spinning
    for (const reel of this.reels) {
      await reel.startSpin();
    }

    try {
      const response = await this.apiClient.spin(
        this.betSelector.getBetPerLine(),
        this.betSelector.getActiveLines(),
      );

      // Stop reels with results
      const window = response.result.window;
      for (let i = 0; i < this.reels.length; i++) {
        const column = window[i] ?? [0, 0, 0];
        await this.reels[i]!.stopSpin(column);
        this.audioManager.playReelStop();
      }

      // Update displays
      this.winDisplay.setBalance(response.balance);

      if (response.result.totalWin > 0) {
        this.winDisplay.animateWin(response.result.totalWin);
        this.audioManager.playWin(response.result.totalWin > 500);

        // Emit particles on winning positions
        for (const line of response.result.winLines) {
          for (const pos of line.positions) {
            const x = this.reelContainer.x + pos.reel * (SYMBOL_SIZE + REEL_GAP) + SYMBOL_SIZE / 2;
            const y = this.reelContainer.y + pos.row * SYMBOL_SIZE + SYMBOL_SIZE / 2;
            this.particles.emit(x, y, 10);
          }
        }

        // Highlight winning lines
        for (const line of response.result.winLines) {
          for (const pos of line.positions) {
            this.reels[pos.reel]?.highlightPositions([pos.row]);
          }
        }
      }

      // Handle free spins
      if (response.freeSpinsRemaining > 0) {
        this.spinButton.setLabel(`FREE ${response.freeSpinsRemaining}`);
      } else {
        this.spinButton.setLabel('SPIN');
      }
    } catch (err) {
      console.error('Spin failed:', err);
    }

    this.spinning = false;
    this.spinButton.setEnabled(true);
  }

  private async onCollect(): Promise<void> {
    try {
      const response = await this.apiClient.collect();
      this.winDisplay.setBalance(response.balance);
      this.winDisplay.setWin(0);
      this.audioManager.playClick();
    } catch (err) {
      console.error('Collect failed:', err);
    }
  }

  updateBalance(balance: number): void {
    this.winDisplay.setBalance(balance);
  }

  private update(): void {
    const delta = this.app.ticker.deltaTime;
    for (const reel of this.reels) {
      reel.update(delta);
    }
    this.particles.update();
  }

  onEnter(): void {
    // Scene entered
  }

  onExit(): void {
    // Cleanup
  }

  onResize(width: number, height: number): void {
    // Scale to fit
    const scaleX = width / 800;
    const scaleY = height / 600;
    const scale = Math.min(scaleX, scaleY, 1.5);
    this.container.scale.set(scale);
    this.container.x = (width - 800 * scale) / 2;
    this.container.y = (height - 600 * scale) / 2;
  }
}
