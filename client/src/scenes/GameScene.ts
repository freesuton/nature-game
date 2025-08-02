import { Scene } from 'phaser';
import { Player } from '../sprites/Player';
import { Bullet } from '../sprites/Bullet';

export class GameScene extends Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private bullets!: Phaser.Physics.Arcade.Group;
  private shootKey!: Phaser.Input.Keyboard.Key;
  private lastShotTime: number = 0;
  private shotCooldown: number = 200; // 200ms between shots

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
    // Create a simple bullet sprite (yellow circle)
    this.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVBiVY/z//z8DJQAggJiYmBgZGRkZGBgYGFatWsVAKQAQQIxMTEwMf//+Zfjx4wfD379/GX7//s3w+/dvBkoAQAAxMjIyMvz584fh27dvDJ8/f2b48uULw5cvXxi+fv3K8P37dwZKAYAAYmRkZGT4+fMnw6dPnxg+fvzI8OHDB4b379+zf/nyhYFSABBAjIyMjAw/fvxg+PDhA8O7d+8Y3r59y/DmzRuG169fM7x69Yrh5cuXDJQCgABiZGRkZPjy5QvDy5cvGV68eMHw/PlzhqdPnzI8efKE4fHjxwyPHj1iePjwIQOlACCAGBkZGRmePXvG8OjRI4aHDx8yPHjwgOH+/fsM9+7dY7h79y7DnTt3GO7cucNAKQAIIEZGRkaGO3fuMNy5c4fh9u3bDLdu3WK4efMmw40bNxiuX7/OcO3aNYZr164xUAoAAoiRkZGR4dq1awzXrl1juHr1KsPVq1cZrly5wnD58mWGy5cvM1y6dImBUgAQQABxoK9zYQQAAAABJRU5ErkJggg==');
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

    // Create bullets group
    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 10,
      runChildUpdate: true
    });

    // Add collision between player and platforms
    this.physics.add.collider(this.player, this.platforms);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    
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
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
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
    
    if (Phaser.Input.Keyboard.JustDown(wasd.W) && onGround) {
      this.player.jump();
    }

    // Handle shooting
    if (this.shootKey.isDown && this.time.now > this.lastShotTime + this.shotCooldown) {
      this.shoot();
      this.lastShotTime = this.time.now;
    }
  }

  private shoot() {
    const spawnPos = this.player.getBulletSpawnPosition();
    
    // Get or create a bullet from the pool
    const bullet = this.bullets.get(spawnPos.x, spawnPos.y) as Bullet;
    
    if (bullet) {
      bullet.fire(spawnPos.x, spawnPos.y, this.player.facingDirection);
      console.log('Bullet fired!', this.player.facingDirection > 0 ? 'right' : 'left');
    }
  }
}