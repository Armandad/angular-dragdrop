/**
 * Audio manager using Howler.js for cross-browser audio.
 * Manages spin, win, and ambient sounds.
 */
export class AudioManager {
  private muted = false;

  /** Play the reel spin sound */
  playSpin(): void {
    if (this.muted) return;
    // In production, use: new Howl({ src: ['/audio/spin.mp3'] }).play();
    this.playTone(200, 0.1, 0.3);
  }

  /** Play reel stop sound */
  playReelStop(): void {
    if (this.muted) return;
    this.playTone(400, 0.05, 0.1);
  }

  /** Play win sound */
  playWin(bigWin = false): void {
    if (this.muted) return;
    if (bigWin) {
      this.playTone(800, 0.2, 0.5);
    } else {
      this.playTone(600, 0.15, 0.3);
    }
  }

  /** Play button click */
  playClick(): void {
    if (this.muted) return;
    this.playTone(500, 0.03, 0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Simple Web Audio API tone for development (replace with Howler.js assets in production) */
  private playTone(freq: number, duration: number, volume: number): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext may not be available
    }
  }
}
