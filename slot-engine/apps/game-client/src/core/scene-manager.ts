import { Application, Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  onEnter(): void;
  onExit(): void;
  onResize(width: number, height: number): void;
}

export class SceneManager {
  private currentScene: Scene | null = null;

  constructor(private app: Application) {}

  setScene(scene: Scene): void {
    if (this.currentScene) {
      this.currentScene.onExit();
      this.app.stage.removeChild(this.currentScene.container);
    }

    this.currentScene = scene;
    this.app.stage.addChild(scene.container);
    scene.onEnter();
    scene.onResize(this.app.screen.width, this.app.screen.height);
  }
}
