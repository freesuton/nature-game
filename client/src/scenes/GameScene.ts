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
    this.gameState = GameLogic.createWorld(this, true); // Enable enemies for single player
    
    // Add quit button as fixed UI element
    const quitButton = this.add.text(16, 16, 'Quit', {
      fontSize: '24px',
      backgroundColor: '#ff4444',
      padding: { x: 10, y: 5 }
    })
    .setInteractive()
    .setScrollFactor(0) // Fix to camera - won't move with world
    .setDepth(1000) // Ensure it's on top
    .on('pointerdown', () => {
      this.scene.start('MenuScene');
    })
    .on('pointerover', () => quitButton.setStyle({ backgroundColor: '#ff6666' }))
    .on('pointerout', () => quitButton.setStyle({ backgroundColor: '#ff4444' }));
    
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
    GameLogic.updateEnemies(this.gameState);
  }
}