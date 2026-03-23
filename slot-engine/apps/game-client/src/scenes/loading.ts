import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Scene } from '../core/scene-manager.js';

/**
 * Loading scene — displayed while assets and game definitions are loading.
 * Shows an animated progress bar and game logo.
 */
export class LoadingScene implements Scene {
  public container: Container;
  private progressBar: Graphics;
  private progressBg: Graphics;
  private statusText: Text;
  private progress = 0;
  private targetProgress = 0;

  constructor(private app: Application) {
    this.container = new Container();

    // Background gradient overlay
    const bg = new Graphics();
    bg.rect(0, 0, 800, 600);
    bg.fill(0x0d0d1a);
    this.container.addChild(bg);

    // Logo text
    const logo = new Text({
      text: 'SLOT ENGINE',
      style: {
        fontFamily: 'Arial',
        fontSize: 48,
        fontWeight: 'bold',
        fill: 0xffd700,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      },
    });
    logo.anchor.set(0.5);
    logo.x = 400;
    logo.y = 200;
    this.container.addChild(logo);

    // Subtitle
    const subtitle = new Text({
      text: 'Loading game assets...',
      style: {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x888888,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = 400;
    subtitle.y = 260;
    this.container.addChild(subtitle);

    // Progress bar background
    this.progressBg = new Graphics();
    this.progressBg.roundRect(200, 320, 400, 20, 10);
    this.progressBg.fill(0x222244);
    this.container.addChild(this.progressBg);

    // Progress bar fill
    this.progressBar = new Graphics();
    this.container.addChild(this.progressBar);

    // Status text
    this.statusText = new Text({
      text: '0%',
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xaaaaaa,
      },
    });
    this.statusText.anchor.set(0.5);
    this.statusText.x = 400;
    this.statusText.y = 360;
    this.container.addChild(this.statusText);

    // Animate
    this.app.ticker.add(() => this.update());
  }

  setProgress(value: number, label?: string): void {
    this.targetProgress = Math.min(1, Math.max(0, value));
    if (label) {
      this.statusText.text = label;
    }
  }

  private update(): void {
    // Smooth progress bar animation
    this.progress += (this.targetProgress - this.progress) * 0.1;

    this.progressBar.clear();
    if (this.progress > 0.01) {
      this.progressBar.roundRect(200, 320, 400 * this.progress, 20, 10);
      this.progressBar.fill(0xffd700);
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
