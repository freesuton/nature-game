import { Scene } from 'phaser';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed: number = 80;
  private direction: number = 1; // 1 for right, -1 for left
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 'player'); // Use player sprite for now
    
    // Add this sprite to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics properties
    this.setCollideWorldBounds(true);
    this.setBounce(0);
    
    // Make enemies red to distinguish from players
    this.setTint(0xff0000);
    
    // Set random initial direction
    this.direction = Math.random() > 0.5 ? 1 : -1;
    
    // Start moving
    this.setVelocityX(this.moveSpeed * this.direction);
    
    // Create animations if they don't exist
    if (!scene.anims.exists('enemy_left')) {
      scene.anims.create({
        key: 'enemy_left',
        frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
    }

    if (!scene.anims.exists('enemy_right')) {
      scene.anims.create({
        key: 'enemy_right',
        frames: scene.anims.generateFrameNumbers('player', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
      });
    }
    
    // Start with appropriate animation
    this.anims.play(this.direction > 0 ? 'enemy_right' : 'enemy_left', true);
  }

  update() {
    // Simple AI: change direction when hitting world bounds or randomly
    if (this.body.blocked.left || this.body.blocked.right || Math.random() < 0.002) {
      this.direction *= -1;
      this.setVelocityX(this.moveSpeed * this.direction);
      this.anims.play(this.direction > 0 ? 'enemy_right' : 'enemy_left', true);
    }
  }

  destroy() {
    super.destroy();
  }
}