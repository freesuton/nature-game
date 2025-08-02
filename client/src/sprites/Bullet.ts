import { Scene } from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 400;
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    
    // Add this sprite to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Set up physics properties
    this.setScale(0.5);
    this.body.setSize(8, 8); // Small collision box
  }

  fire(x: number, y: number, direction: number) {
    // Reset position
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    
    // Set velocity based on direction (1 for right, -1 for left)
    this.setVelocityX(this.speed * direction);
    this.setVelocityY(0);
  }

  update() {
    // Destroy bullet if it goes off screen
    if (this.x < -50 || this.x > 850) {
      this.destroy();
    }
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.update();
  }
}