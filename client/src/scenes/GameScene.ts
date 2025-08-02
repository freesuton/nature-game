import { Scene } from 'phaser';
import { Player } from '../sprites/Player';

export class GameScene extends Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load game assets
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.spritesheet('player', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
  }

  create() {
    // Create platforms
    this.platforms = this.physics.add.staticGroup();
    
    // Create ground
    this.platforms.create(400, 568, 'ground').setScale(2).refreshBody();

    // Create some platforms
    this.platforms.create(600, 400, 'ground');
    this.platforms.create(50, 250, 'ground');
    this.platforms.create(750, 220, 'ground');

    // Create player
    this.player = new Player(this, 100, 450);

    // Add collision between player and platforms
    this.physics.add.collider(this.player, this.platforms);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    // Debug: Add key press listeners
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      console.log('Key pressed:', event.code);
    });

    // Set up camera to follow player
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(100, 100);
  }

  update() {
    // Safety check
    if (!this.player || !this.cursors) {
      return;
    }

    // Handle player movement
    if (this.cursors.left.isDown) {
      this.player.moveLeft();
    } else if (this.cursors.right.isDown) {
      this.player.moveRight();
    } else {
      this.player.stop();
    }

    // Handle jumping - check if player is on ground or platform
    const onGround = this.player.body && (this.player.body.touching.down || this.player.body.blocked.down);
    if (this.cursors.up.isDown && onGround) {
      this.player.jump();
    }

    // Additional controls - WASD support
    const wasd = this.input.keyboard!.addKeys('W,S,A,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    if (wasd.A.isDown) {
      this.player.moveLeft();
    } else if (wasd.D.isDown) {
      this.player.moveRight();
    }
    
    if (wasd.W.isDown && onGround) {
      this.player.jump();
    }
  }
}