import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';
import type { ApiClient } from '../core/api-client.js';
import type { AudioManager } from '../audio/audio-manager.js';
import type { KeyAction } from '../core/keyboard.js';
import { ReelStrip } from '../components/reel/reel-strip.js';
import { SpinButton } from '../components/ui/spin-button.js';
import { BetSelector } from '../components/ui/bet-selector.js';
import { WinDisplay } from '../components/ui/win-display.js';
import { WinParticles } from '../components/effects/particles.js';
import { WinLineOverlay } from '../components/effects/win-lines.js';
import { Toolbar } from '../components/ui/toolbar.js';
import { AutoPlayPanel } from '../components/ui/auto-play.js';
import { GameHistoryPanel } from '../components/ui/game-history.js';
import { PaytablePanel } from '../components/ui/paytable-panel.js';
import { KeyboardManager } from '../core/keyboard.js';

const REEL_COUNT = 5;
const ROW_COUNT = 3;
const SYMBOL_SIZE = 120;
const REEL_GAP = 10;

export interface MainGameConfig {
  gameName: string;
  denominations: number[];
  maxLines: number;
  symbolNames?: Record<number, string>;
}

export class MainGameScene implements Scene {
  public container: Container;
  private reels: ReelStrip[] = [];
  private spinButton: SpinButton;
  private betSelector: BetSelector;
  private winDisplay: WinDisplay;
  private particles: WinParticles;
  private winLines: WinLineOverlay;
  private toolbar: Toolbar;
  private autoPlay: AutoPlayPanel;
  private history: GameHistoryPanel;
  private paytable: PaytablePanel;
  private keyboard: KeyboardManager;
  private reelContainer: Container;
  private reelBgX: number;
  private reelBgY: number;
  private spinning = false;
  private gameState: string = 'IDLE';
  private currentWin = 0;
  private onNavigate: (target: 'lobby' | 'gamble' | 'bonus', data?: unknown) => void;

  constructor(
    private app: Application,
    private apiClient: ApiClient,
    private audioManager: AudioManager,
    private config: MainGameConfig,
    onNavigate: (target: 'lobby' | 'gamble' | 'bonus', data?: unknown) => void,
  ) {
    this.container = new Container();
    this.onNavigate = onNavigate;

    // Title
    const title = new Text({
      text: config.gameName.toUpperCase(),
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffd700,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = 400;
    title.y = 10;
    this.container.addChild(title);

    // Reel background
    const reelBg = new Graphics();
    const totalWidth = REEL_COUNT * (SYMBOL_SIZE + REEL_GAP) - REEL_GAP + 20;
    const totalHeight = ROW_COUNT * SYMBOL_SIZE + 20;
    reelBg.roundRect(0, 0, totalWidth, totalHeight, 10);
    reelBg.fill(0x111122);
    reelBg.stroke({ width: 2, color: 0x333366 });
    this.reelBgX = (800 - totalWidth) / 2;
    this.reelBgY = 55;
    reelBg.x = this.reelBgX;
    reelBg.y = this.reelBgY;
    this.container.addChild(reelBg);

    // Create reels
    this.reelContainer = new Container();
    this.reelContainer.x = this.reelBgX + 10;
    this.reelContainer.y = this.reelBgY + 10;

    for (let i = 0; i < REEL_COUNT; i++) {
      const reel = new ReelStrip(i, ROW_COUNT);
      reel.container.x = i * (SYMBOL_SIZE + REEL_GAP);
      this.reels.push(reel);
      this.reelContainer.addChild(reel.container);
    }
    this.container.addChild(this.reelContainer);

    // Win line overlay
    this.winLines = new WinLineOverlay();
    this.container.addChild(this.winLines.container);

    // Particles effect
    this.particles = new WinParticles();
    this.container.addChild(this.particles.container);

    // Win display
    this.winDisplay = new WinDisplay();
    this.winDisplay.container.x = 200;
    this.winDisplay.container.y = 435;
    this.container.addChild(this.winDisplay.container);

    // Bet selector
    this.betSelector = new BetSelector(config.denominations, config.maxLines);
    this.betSelector.container.x = 60;
    this.betSelector.container.y = 495;
    this.container.addChild(this.betSelector.container);

    // Spin button
    this.spinButton = new SpinButton(() => this.onSpin());
    this.spinButton.container.x = 520;
    this.spinButton.container.y = 495;
    this.container.addChild(this.spinButton.container);

    // Collect button
    this.createActionButtons();

    // Toolbar (sound, info, history, fullscreen, auto-play)
    this.toolbar = new Toolbar({
      onToggleSound: () => {
        this.audioManager.setMuted(!this.audioManager.isMuted());
      },
      onToggleInfo: () => this.paytable.toggle(),
      onToggleHistory: () => this.history.toggle(),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onToggleAutoPlay: () => {},
    });
    this.toolbar.container.x = 510;
    this.toolbar.container.y = 555;
    this.container.addChild(this.toolbar.container);

    // Auto-play
    this.autoPlay = new AutoPlayPanel(
      (_config) => {
        // Start auto-play — spin automatically
        this.runAutoPlay();
      },
      () => {},
    );
    this.autoPlay.container.x = 60;
    this.autoPlay.container.y = 555;
    this.container.addChild(this.autoPlay.container);

    // Game history panel (overlay)
    this.history = new GameHistoryPanel();
    this.container.addChild(this.history.container);

    // Paytable panel (overlay)
    this.paytable = new PaytablePanel([
      { symbolName: 'Seven', color: 0xc0392b, pays: { 3: 50, 4: 200, 5: 1000 } },
      { symbolName: 'Grape', color: 0x9b59b6, pays: { 3: 25, 4: 100, 5: 500 } },
      { symbolName: 'Watermelon', color: 0x27ae60, pays: { 3: 20, 4: 80, 5: 400 } },
      { symbolName: 'Bell', color: 0xd4ac0d, pays: { 3: 15, 4: 60, 5: 200 } },
      { symbolName: 'Plum', color: 0x8e44ad, pays: { 3: 15, 4: 60, 5: 200 } },
      { symbolName: 'Orange', color: 0xf39c12, pays: { 3: 10, 4: 40, 5: 150 } },
      { symbolName: 'Lemon', color: 0xf1c40f, pays: { 3: 10, 4: 40, 5: 150 } },
      { symbolName: 'Cherry', color: 0xe74c3c, pays: { 2: 2, 3: 5, 4: 25, 5: 100 } },
      { symbolName: 'Wild', color: 0xff4444, pays: { 3: 10, 4: 50, 5: 200 } },
    ],
    {
      name: 'Crown',
      triggerCount: 3,
      spinsAwarded: 15,
      multiplier: 3,
    },
    {
      maxAttempts: 5,
      multiplier: 2,
    });
    this.container.addChild(this.paytable.container);

    // Back to lobby button
    const backBtn = new Container();
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';
    backBtn.x = 10;
    backBtn.y = 10;

    const backBg = new Graphics();
    backBg.roundRect(0, 0, 70, 28, 5);
    backBg.fill(0x333355);
    backBtn.addChild(backBg);

    const backText = new Text({
      text: '\u2190 LOBBY',
      style: { fontFamily: 'Arial', fontSize: 12, fontWeight: 'bold', fill: 0xaaaaaa },
    });
    backText.x = 8;
    backText.y = 6;
    backBtn.addChild(backText);
    backBtn.on('pointerdown', () => {
      if (!this.spinning) this.onNavigate('lobby');
    });
    this.container.addChild(backBtn);

    // Keyboard shortcuts
    this.keyboard = new KeyboardManager();
    this.keyboard.onAction((action) => this.onKeyAction(action));

    // Update loop
    this.app.ticker.add(() => this.update());
  }

  private createActionButtons(): void {
    // Collect button
    const collectBtn = new Container();
    collectBtn.eventMode = 'static';
    collectBtn.cursor = 'pointer';
    collectBtn.x = 520;
    collectBtn.y = 555;

    const collectBg = new Graphics();
    collectBg.roundRect(0, 0, 90, 32, 6);
    collectBg.fill(0x2980b9);
    collectBtn.addChild(collectBg);

    const collectText = new Text({
      text: 'COLLECT',
      style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xffffff },
    });
    collectText.anchor.set(0.5);
    collectText.x = 45;
    collectText.y = 16;
    collectBtn.addChild(collectText);
    collectBtn.on('pointerdown', () => this.onCollect());

    // Gamble button
    const gambleBtn = new Container();
    gambleBtn.eventMode = 'static';
    gambleBtn.cursor = 'pointer';
    gambleBtn.x = 415;
    gambleBtn.y = 555;

    const gambleBg = new Graphics();
    gambleBg.roundRect(0, 0, 90, 32, 6);
    gambleBg.fill(0xc0392b);
    gambleBtn.addChild(gambleBg);

    const gambleText = new Text({
      text: 'GAMBLE',
      style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: 0xffffff },
    });
    gambleText.anchor.set(0.5);
    gambleText.x = 45;
    gambleText.y = 16;
    gambleBtn.addChild(gambleText);
    gambleBtn.on('pointerdown', () => this.onGamble());

    this.container.addChild(collectBtn);
    this.container.addChild(gambleBtn);
  }

  private onKeyAction(action: KeyAction): void {
    if (this.paytable.isVisible() || this.history.isVisible()) {
      if (action === 'toggle-info') this.paytable.hide();
      if (action === 'toggle-history') this.history.hide();
      return;
    }

    switch (action) {
      case 'spin':
        if (this.gameState === 'AWAITING_COLLECT') {
          this.onCollect();
        } else if (!this.spinning) {
          this.onSpin();
        }
        break;
      case 'collect':
        this.onCollect();
        break;
      case 'gamble-red':
      case 'gamble-black':
        if (this.gameState === 'AWAITING_COLLECT') this.onGamble();
        break;
      case 'auto-play':
        // Toggle auto-play config panel
        break;
      case 'toggle-info':
        this.paytable.toggle();
        break;
      case 'toggle-history':
        this.history.toggle();
        break;
      case 'toggle-mute':
        this.audioManager.setMuted(!this.audioManager.isMuted());
        break;
      case 'toggle-fullscreen':
        this.toggleFullscreen();
        break;
      case 'bet-up':
      case 'bet-down':
      case 'lines-up':
      case 'lines-down':
        break;
    }
  }

  private async onSpin(): Promise<void> {
    if (this.spinning) return;
    this.spinning = true;
    this.gameState = 'SPINNING';
    this.spinButton.setEnabled(false);
    this.winDisplay.setWin(0);
    this.particles.clear();
    this.winLines.clear();
    this.audioManager.playSpin();

    // Start all reels spinning
    for (const reel of this.reels) {
      reel.startSpin();
    }

    try {
      const response = await this.apiClient.spin(
        this.betSelector.getBetPerLine(),
        this.betSelector.getActiveLines(),
      );

      // Stop reels with results (staggered)
      const window = response.result.window;
      for (let i = 0; i < this.reels.length; i++) {
        const column = window[i] ?? [0, 0, 0];
        await this.reels[i]!.stopSpin(column);
        this.audioManager.playReelStop();
      }

      // Update displays
      this.winDisplay.setBalance(response.balance);
      this.gameState = response.state;
      this.currentWin = response.result.totalWin;

      // Record in history
      this.history.addEntry(
        this.betSelector.getBetPerLine(),
        this.betSelector.getActiveLines(),
        response.result,
      );

      if (response.result.totalWin > 0) {
        this.winDisplay.animateWin(response.result.totalWin);
        this.audioManager.playWin(response.result.totalWin > 500);

        // Show win line overlay
        this.winLines.showSequential(
          response.result.winLines,
          this.reelContainer.x,
          this.reelContainer.y,
          1500,
        );

        // Emit particles on winning positions
        for (const line of response.result.winLines) {
          for (const pos of line.positions) {
            const x = this.reelContainer.x + pos.reel * (SYMBOL_SIZE + REEL_GAP) + SYMBOL_SIZE / 2;
            const y = this.reelContainer.y + pos.row * SYMBOL_SIZE + SYMBOL_SIZE / 2;
            this.particles.emit(x, y, 10);
          }
        }
      }

      // Handle free spins trigger
      if (response.freeSpinsRemaining > 0 && response.result.freeSpinsAwarded > 0) {
        this.spinButton.setLabel(`FREE ${response.freeSpinsRemaining}`);
        // Navigate to bonus scene
        setTimeout(() => {
          this.onNavigate('bonus', {
            spinsAwarded: response.result.freeSpinsAwarded,
            freeSpinsRemaining: response.freeSpinsRemaining,
          });
        }, 1500);
      } else if (response.freeSpinsRemaining > 0) {
        this.spinButton.setLabel(`FREE ${response.freeSpinsRemaining}`);
      } else {
        this.spinButton.setLabel('SPIN');
      }

      // Auto-play handling
      if (this.autoPlay.isActive()) {
        const shouldContinue = this.autoPlay.onSpinComplete(
          response.result.totalWin,
          response.balance,
          response.result.freeSpinsAwarded > 0,
        );

        if (shouldContinue && response.state === 'IDLE') {
          setTimeout(() => this.onSpin(), 1000);
        }
      }
    } catch (err) {
      console.error('Spin failed:', err);
    }

    this.spinning = false;
    this.spinButton.setEnabled(true);
  }

  private async runAutoPlay(): Promise<void> {
    if (!this.spinning && this.gameState === 'IDLE') {
      await this.onSpin();
    }
  }

  private async onCollect(): Promise<void> {
    if (this.gameState !== 'AWAITING_COLLECT') return;

    try {
      const response = await this.apiClient.collect();
      this.winDisplay.setBalance(response.balance);
      this.winDisplay.setWin(0);
      this.winLines.clear();
      this.particles.clear();
      this.gameState = response.state;
      this.currentWin = 0;
      this.audioManager.playClick();
    } catch (err) {
      console.error('Collect failed:', err);
    }
  }

  private onGamble(): void {
    if (this.gameState !== 'AWAITING_COLLECT' || this.currentWin <= 0) return;
    this.winLines.clear();
    this.particles.clear();
    this.onNavigate('gamble', { currentWin: this.currentWin });
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  updateBalance(balance: number): void {
    this.winDisplay.setBalance(balance);
  }

  updateGameState(state: string): void {
    this.gameState = state;
  }

  private update(): void {
    const delta = this.app.ticker.deltaTime;
    for (const reel of this.reels) {
      reel.update(delta);
    }
    this.particles.update();
    this.winLines.update();
  }

  onEnter(): void {
    this.keyboard.setEnabled(true);
  }

  onExit(): void {
    this.keyboard.setEnabled(false);
    this.autoPlay.stopAutoPlay();
    this.winLines.clear();
    this.particles.clear();
  }

  onResize(width: number, height: number): void {
    const scaleX = width / 800;
    const scaleY = height / 600;
    const scale = Math.min(scaleX, scaleY, 1.5);
    this.container.scale.set(scale);
    this.container.x = (width - 800 * scale) / 2;
    this.container.y = (height - 600 * scale) / 2;
  }
}
