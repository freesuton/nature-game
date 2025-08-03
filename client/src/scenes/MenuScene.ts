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

    // Add multiplayer button
    const multiplayerBtn = this.add.text(400, 380, 'Join Multiplayer', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#1976D2',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', () => multiplayerBtn.setAlpha(0.8))
    .on('pointerout', () => multiplayerBtn.setAlpha(1))
    .on('pointerdown', () => this.startMultiplayer());

    // Add instructions
    this.add.text(400, 500, 'Controls:\nArrow Keys/WASD - Move\nUp/W - Jump\nJ - Shoot', {
      fontSize: '18px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  private startSinglePlayer() {
    this.scene.start('GameScene');
  }

  private startMultiplayer() {
    this.scene.start('MultiplayerGameScene');
  }
}