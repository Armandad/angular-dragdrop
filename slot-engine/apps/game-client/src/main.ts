import { Application } from 'pixi.js';
import { SceneManager } from './core/scene-manager.js';
import { ApiClient } from './core/api-client.js';
import { MainGameScene } from './scenes/main-game.js';
import { AudioManager } from './audio/audio-manager.js';

async function main(): Promise<void> {
  // Create PixiJS application
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  // Remove loading screen
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.remove();

  // Initialize core systems
  const apiClient = new ApiClient();
  const audioManager = new AudioManager();
  const sceneManager = new SceneManager(app);

  // Create and start the main game scene
  const mainScene = new MainGameScene(app, apiClient, audioManager);
  sceneManager.setScene(mainScene);

  // Handle responsive resizing
  window.addEventListener('resize', () => {
    mainScene.onResize(app.screen.width, app.screen.height);
  });

  // Initialize session
  try {
    await apiClient.createSession('demo-player', 'shining-crown');
    mainScene.updateBalance(apiClient.getBalance());
  } catch (err) {
    console.error('Failed to create session:', err);
  }
}

main().catch(console.error);
