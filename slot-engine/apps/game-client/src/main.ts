import { Application } from 'pixi.js';
import { SceneManager } from './core/scene-manager.js';
import { ApiClient } from './core/api-client.js';
import { ResponsiveManager } from './core/responsive.js';
import { AudioManager } from './audio/audio-manager.js';
import { LoadingScene } from './scenes/loading.js';
import { LobbyScene } from './scenes/lobby.js';
import { MainGameScene } from './scenes/main-game.js';
import { GambleScene } from './scenes/gamble.js';
import { BonusScene } from './scenes/bonus.js';

async function main(): Promise<void> {
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  // Remove loading DOM element
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.remove();

  // Core systems
  const apiClient = new ApiClient();
  const audioManager = new AudioManager();
  const sceneManager = new SceneManager(app);
  const responsive = new ResponsiveManager();

  // Loading scene
  const loadingScene = new LoadingScene(app);
  sceneManager.setScene(loadingScene);
  loadingScene.setProgress(0.2, 'Connecting to server...');

  // Scene navigation functions
  function showLobby(): void {
    const lobbyScene = new LobbyScene(app, apiClient, (gameId) => {
      showGame(gameId);
    });
    sceneManager.setScene(lobbyScene);
  }

  async function showGame(gameId: string): Promise<void> {
    // Create a session for this game
    loadingScene.setProgress(0.5, `Loading ${gameId}...`);
    sceneManager.setScene(loadingScene);

    try {
      await apiClient.createSession('demo-player', gameId);
      loadingScene.setProgress(0.9, 'Starting game...');

      // Get game config from API
      const games = await apiClient.listGames();
      const gameConfig = games.find((g) => g.gameId === gameId);

      const mainGame = new MainGameScene(
        app,
        apiClient,
        audioManager,
        {
          gameName: gameConfig?.name ?? gameId,
          denominations: gameConfig?.denominations ?? [1, 2, 5, 10, 20, 50, 100],
          maxLines: gameConfig?.maxBetLines ?? 10,
        },
        (target, data) => {
          switch (target) {
            case 'lobby':
              showLobby();
              break;
            case 'gamble':
              showGamble(mainGame, (data as { currentWin: number })?.currentWin ?? 0);
              break;
            case 'bonus':
              showBonus(mainGame, data as { spinsAwarded: number });
              break;
          }
        },
      );

      sceneManager.setScene(mainGame);
      mainGame.updateBalance(apiClient.getBalance());
    } catch (err) {
      console.error('Failed to start game:', err);
      loadingScene.setProgress(1, 'Connection failed. Retrying...');
      setTimeout(() => showLobby(), 2000);
    }
  }

  function showGamble(mainGame: MainGameScene, currentWin: number): void {
    const gambleScene = new GambleScene(
      app,
      apiClient,
      audioManager,
      currentWin,
      (collected) => {
        // Return to main game
        sceneManager.setScene(mainGame);
        mainGame.updateBalance(apiClient.getBalance());
        mainGame.updateGameState('IDLE');
      },
    );
    sceneManager.setScene(gambleScene);
  }

  function showBonus(mainGame: MainGameScene, data: { spinsAwarded: number }): void {
    const bonusScene = new BonusScene(
      app,
      audioManager,
      data.spinsAwarded,
      3, // multiplier — should come from game config
      (totalWin) => {
        // Return to main game
        sceneManager.setScene(mainGame);
        mainGame.updateBalance(apiClient.getBalance());
        mainGame.updateGameState(totalWin > 0 ? 'AWAITING_COLLECT' : 'IDLE');
      },
    );
    sceneManager.setScene(bonusScene);
  }

  // Responsive resize handler
  responsive.onResize((metrics) => {
    // The scene's own onResize handles this via SceneManager
  });

  // Try to connect and show lobby
  try {
    loadingScene.setProgress(0.5, 'Loading games...');

    // Test server connection
    const games = await apiClient.listGames();
    loadingScene.setProgress(1, 'Ready!');

    setTimeout(() => {
      if (games.length === 1) {
        // If only one game, go directly to it
        showGame(games[0]!.gameId);
      } else {
        showLobby();
      }
    }, 500);
  } catch {
    loadingScene.setProgress(0.3, 'Server offline — starting demo mode...');

    // Demo mode: create session without server
    setTimeout(() => {
      showLobby();
    }, 1500);
  }
}

main().catch(console.error);
