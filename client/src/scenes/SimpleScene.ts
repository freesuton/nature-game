import * as Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';

interface SimplePlayer {
  x: number;
  y: number;
  movingLeft: boolean;
  movingRight: boolean;
}

export class SimpleScene extends Phaser.Scene {
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;
  private playerSprites: Map<string, { sprite: Phaser.GameObjects.Sprite, debugRect: Phaser.GameObjects.Rectangle }> = new Map();
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };

  constructor() {
    super({ 
      key: 'SimpleScene',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 600 },
          debug: true, // Match game config
          width: 800,  // Match server size
          height: 600
        }
      }
    });
  }

  preload() {
    // Load the dude sprite from Phaser labs
    this.load.spritesheet('dude', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
  }

  create() {
    console.log('SimpleScene created');

    // Create platforms array
    const platforms: Phaser.Physics.Arcade.StaticBody[] = [];
    

    // Create platforms matching server
    platforms.push(this.physics.add.staticBody(0, 500, 800, 20)); // Ground
    platforms.push(this.physics.add.staticBody(600, 400, 200, 20)); // Platform 1
    platforms.push(this.physics.add.staticBody(50, 250, 200, 20));  // Platform 2
    platforms.push(this.physics.add.staticBody(750, 220, 200, 20)); // Platform 3
    

    // Add vertical ruler marks every 100 pixels
    for (let y = 0; y <= 600; y += 100) {
      this.add.line(0, y, 0, 0, 20, 0, 0x000000, 1).setLineWidth(2); // Ruler mark
      this.add.text(25, y - 10, `${y}px`, { fontSize: '12px', color: '#000000' }); // Height label
    }

    // Add horizontal ruler marks every 100 pixels
    for (let x = 0; x <= 800; x += 100) {
      this.add.line(x, 0, 0, 0, 0, 20, 0x000000, 1).setLineWidth(2); // Ruler mark
      this.add.text(x - 15, 25, `${x}px`, { fontSize: '12px', color: '#000000' }); // Width label
    }
    

    // Setup WASD input
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D') as any;

    // Menu key
    this.input.keyboard!.on('keydown-M', () => {
      this.leaveRoom();
      this.scene.start('MenuScene');
    });

    // Connect to server
    this.connectToServer();
  }

  private async connectToServer() {
    try {
      this.client = new Colyseus.Client('ws://localhost:2567');
      this.room = await this.client.joinOrCreate('simple');

      console.log('Connected to SimpleRoom');

      // When a player is added
      this.room.state.players.onAdd((player: SimplePlayer, sessionId: string) => {
        console.log('Player added:', sessionId, 'at', player.x, player.y);
        
        // Create player sprite using the dude spritesheet
        // setOrigin(0, 0) is important to match server's origin which is generated from left top corner
        const sprite = this.add.sprite(player.x, player.y, 'dude', 0).setOrigin(0, 0);
        
        // Add debug rectangle around character for testing collision boundaries
        const debugRect = this.add.rectangle(player.x, player.y, 32, 48).setOrigin(0, 0);
        debugRect.setStrokeStyle(2, 0xff0000, 0.8); // Red border with transparency
        debugRect.setFillStyle(0x000000, 0); // Transparent fill
        
        // Create animations for the sprite
        if (!this.anims.exists('left')) {
          this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
          });
        }
        
        if (!this.anims.exists('right')) {
          this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
          });
        }
        
        if (!this.anims.exists('turn')) {
          this.anims.create({
            key: 'turn',
            frames: [{ key: 'dude', frame: 4 }],
            frameRate: 20
          });
        }
        
        this.playerSprites.set(sessionId, { sprite, debugRect });

        // Listen for changes to this specific player
        (player as any).onChange(() => {
          console.log(`Player ${sessionId} position update: x=${player.x}, y=${player.y}, left=${player.movingLeft}, right=${player.movingRight}`);
          
          // Get sprite and debug rectangle from map
          const playerObjects = this.playerSprites.get(sessionId);
          if (!playerObjects) return;
          
          // Update both sprite and debug rectangle positions
          playerObjects.sprite.setPosition(player.x, player.y);
          playerObjects.debugRect.setPosition(player.x, player.y);
          
          // Play animations based on movement
          if (player.movingLeft) {
            playerObjects.sprite.anims.play('left', true);
          } else if (player.movingRight) {
            playerObjects.sprite.anims.play('right', true);
          } else {
            playerObjects.sprite.anims.play('turn', true);
          }
        });
      });

      // When a player is removed
      this.room.state.players.onRemove((_player: SimplePlayer, sessionId: string) => {
        console.log('Player removed:', sessionId);
        
        const playerObjects = this.playerSprites.get(sessionId);
        if (playerObjects) {
          playerObjects.sprite.destroy();
          playerObjects.debugRect.destroy();
          this.playerSprites.delete(sessionId);
        }
      });

      // Handle connection errors
      this.room.onError((code: number, message?: string) => {
        console.error('Room error:', code, message);
      });

      this.room.onLeave((code: number) => {
        console.log('Left room with code:', code);
      });

    } catch (error) {
      console.error('Failed to connect to server:', error);
    }
  }

  update() {
    if (!this.room) return;

    // Send input to server (WASD only)
    const leftPressed = this.wasdKeys.A.isDown;
    const rightPressed = this.wasdKeys.D.isDown;

    const jumpPressed = this.wasdKeys.W.isDown;

    // Always send input state
    this.room.send('move', {
      left: leftPressed,
      right: rightPressed,
      jump: jumpPressed
    });
  }

  private leaveRoom() {
    if (this.room) {
      this.room.leave();
    }
  }

  shutdown() {
    this.leaveRoom();
  }
}