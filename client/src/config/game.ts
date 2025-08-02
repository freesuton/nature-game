import { Types } from 'phaser';
import { GameScene } from '../scenes/GameScene';

export const GameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#87CEEB', // Sky blue background
  scale: {
    width: 800,
    height: 600,
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      debug: true // Set to false in production
    }
  },
  scene: [GameScene]
};