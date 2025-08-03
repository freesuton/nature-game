import { Scene } from 'phaser';
import { GameLogic, GameState } from '../utils/GameLogic';

export class GameScene extends Scene {
  private gameState!: GameState;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    GameLogic.preloadAssets(this);
  }

  create() {
    this.gameState = GameLogic.createWorld(this);
    
    // Debug: Add key press listeners
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      console.log('Key pressed:', event.code);
    });
  }

  update() {
    GameLogic.handleMovement(this.gameState);
    GameLogic.handleShooting(this.gameState, this, (x, y, direction) => {
      console.log('Bullet fired!', direction > 0 ? 'right' : 'left');
    });
  }
}