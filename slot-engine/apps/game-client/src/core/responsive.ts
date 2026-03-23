/**
 * Responsive layout manager — handles device scaling, orientation,
 * and adaptive layouts for mobile/tablet/desktop.
 */
export interface LayoutConfig {
  designWidth: number;
  designHeight: number;
  minScale: number;
  maxScale: number;
}

export interface LayoutMetrics {
  scale: number;
  offsetX: number;
  offsetY: number;
  isPortrait: boolean;
  isMobile: boolean;
  devicePixelRatio: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  designWidth: 800,
  designHeight: 600,
  minScale: 0.5,
  maxScale: 2.0,
};

export class ResponsiveManager {
  private config: LayoutConfig;
  private listeners: Array<(metrics: LayoutMetrics) => void> = [];
  private currentMetrics: LayoutMetrics;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentMetrics = this.calculate(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', () => {
      this.update();
    });

    // Handle orientation change on mobile
    window.addEventListener('orientationchange', () => {
      // Delay to let the browser finish rotating
      setTimeout(() => this.update(), 100);
    });

    // Handle fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => this.update(), 100);
    });
  }

  getMetrics(): LayoutMetrics {
    return { ...this.currentMetrics };
  }

  onResize(callback: (metrics: LayoutMetrics) => void): void {
    this.listeners.push(callback);
  }

  private update(): void {
    this.currentMetrics = this.calculate(window.innerWidth, window.innerHeight);
    for (const listener of this.listeners) {
      listener(this.currentMetrics);
    }
  }

  private calculate(viewWidth: number, viewHeight: number): LayoutMetrics {
    const { designWidth, designHeight, minScale, maxScale } = this.config;

    const scaleX = viewWidth / designWidth;
    const scaleY = viewHeight / designHeight;
    const scale = Math.max(minScale, Math.min(maxScale, Math.min(scaleX, scaleY)));

    const offsetX = (viewWidth - designWidth * scale) / 2;
    const offsetY = (viewHeight - designHeight * scale) / 2;

    const isPortrait = viewHeight > viewWidth;
    const isMobile = viewWidth <= 768 || ('ontouchstart' in window);
    const devicePixelRatio = window.devicePixelRatio || 1;

    return { scale, offsetX, offsetY, isPortrait, isMobile, devicePixelRatio };
  }

  /**
   * Request fullscreen mode (useful for mobile).
   */
  async requestFullscreen(element?: HTMLElement): Promise<void> {
    const el = element ?? document.documentElement;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen not available
    }
  }

  /**
   * Lock orientation to landscape (for mobile slot play).
   */
  async lockLandscape(): Promise<void> {
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch {
      // Orientation lock not available
    }
  }
}
