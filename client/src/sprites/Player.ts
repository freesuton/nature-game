import { Scene } from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private moveSpeed: number = 160;
  private jumpForce: number = -330;
  declare body: Phaser.Physics.Arcade.Body;
  public facingDirection: number = 1; // 1 for right, -1 for left

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    
    // Add this sprite to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics properties
    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setDragX(500); // Add some drag for better control

    // Create animations
    scene.anims.create({
      key: 'left',
      frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    scene.anims.create({
      key: 'turn',
      frames: [{ key: 'player', frame: 4 }],
      frameRate: 20
    });

    scene.anims.create({
      key: 'right',
      frames: scene.anims.generateFrameNumbers('player', { start: 5, end: 8 }),
      frameRate: 10,
      repeat: -1
    });
  }

  moveLeft() {
    this.setVelocityX(-this.moveSpeed);
    this.anims.play('left', true);
    this.facingDirection = -1;
    console.log('Moving left, velocity:', this.body.velocity.x);
  }

  moveRight() {
    this.setVelocityX(this.moveSpeed);
    this.anims.play('right', true);
    this.facingDirection = 1;
    console.log('Moving right, velocity:', this.body.velocity.x);
  }

  stop(): this {
    this.setVelocityX(0);
    this.anims.play('turn');
    return this;
  }

  jump() {
    this.setVelocityY(this.jumpForce);
    console.log('Jumping, velocity Y:', this.body.velocity.y);
  }

  getBulletSpawnPosition() {
    // Return position slightly in front of player
    const offsetX = this.facingDirection * 20;
    return {
      x: this.x + offsetX,
      y: this.y - 5 // Slightly above center
    };
  }
}