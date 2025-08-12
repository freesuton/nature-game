import { Scene } from 'phaser';

export class MenuScene extends Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    // Add title text
    this.add.text(400, 200, 'Nature Platform Game', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Add single player button
    const singlePlayerBtn = this.add.text(400, 300, 'Single Player', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#2E7D32',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => singlePlayerBtn.setAlpha(0.8))
    .on('pointerout', () => singlePlayerBtn.setAlpha(1))
    .on('pointerdown', () => this.startSinglePlayer());

    // Add simple game button
    const simpleBtn = this.add.text(400, 360, 'Simple Game', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#FF9800',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => simpleBtn.setAlpha(0.8))
    .on('pointerout', () => simpleBtn.setAlpha(1))
    .on('pointerdown', () => this.startSimple());

    // Add instructions
    this.add.text(400, 460, 'Controls:\nArrow Keys/WASD - Move\nUp/W - Jump\nJ - Shoot\nSimple: Server physics only', {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  private startSinglePlayer() {
    this.scene.start('GameScene');
  }

  private startSimple() {
    this.scene.start('SimpleScene');
  }
}