import { Scene } from 'phaser';

export class SimplePlayerConfig {
  public sprite: Phaser.GameObjects.Sprite;
  public debugRect: Phaser.GameObjects.Rectangle;
  private facingDirection: 'left' | 'right' = 'right';

  constructor(scene: Scene, x: number, y: number, color?: number) {
    // Create player sprite using the dude spritesheet
    // setOrigin(0, 0) is important to match server's origin which is generated from left top corner
    this.sprite = scene.add.sprite(x, y, 'dude', 0).setOrigin(0, 0);
    
    // Apply color tint if provided
    if (color !== undefined) {
      this.sprite.setTint(color);
    }

    // Add debug rectangle around character for testing collision boundaries
    this.debugRect = scene.add.rectangle(x, y, 32, 48).setOrigin(0, 0);
    this.debugRect.setStrokeStyle(2, color || 0xff0000, 0.8); // Use provided color or default red
    this.debugRect.setFillStyle(0x000000, 0); // Transparent fill

    // Create animations for the sprite
    this.createAnimations(scene);
  }

  private createAnimations(scene: Scene): void {
    // Create animations for the sprite
    if (!scene.anims.exists('left')) {
      scene.anims.create({
        key: 'left',
        frames: scene.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
      });
    }
    
    if (!scene.anims.exists('right')) {
      scene.anims.create({
        key: 'right',
        frames: scene.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
      });
    }
    
    if (!scene.anims.exists('turn')) {
      scene.anims.create({
        key: 'turn',
        frames: [{ key: 'dude', frame: 4 }],
        frameRate: 20
      });
    }
  }

  updateMovement(movingLeft: boolean, movingRight: boolean): void {
    // Play animations based on movement, stop and show facing direction when stopped
    if (movingLeft) {
      this.sprite.anims.play('left', true);
      this.facingDirection = 'left'; // Update facing direction
    } else if (movingRight) {
      this.sprite.anims.play('right', true);
      this.facingDirection = 'right'; // Update facing direction
    } else {
      // Stop animation and show static facing frame
      this.sprite.anims.stop();
      if (this.facingDirection === 'left') {
        this.sprite.setFrame(0); // Left-facing static frame
      } else {
        this.sprite.setFrame(5); // Right-facing static frame
      }
    }
  }

  updatePosition(x: number, y: number): void {
    // Update both sprite and debug rectangle positions
    this.sprite.setPosition(x, y);
    this.debugRect.setPosition(x, y);
  }

  destroy(): void {
    this.sprite.destroy();
    this.debugRect.destroy();
  }
}