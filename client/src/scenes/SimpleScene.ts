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
  private playerSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
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

  create() {
    console.log('SimpleScene created');

        // Create platforms array
        const platforms: Phaser.Physics.Arcade.StaticBody[] = [];
        
        // Create platforms matching server
        platforms.push(this.physics.add.staticBody(400, 500, 800, 2)); // Ground
        platforms.push(this.physics.add.staticBody(600, 400, 200, 2)); // Platform 1
        platforms.push(this.physics.add.staticBody(50, 250, 200, 2));  // Platform 2
        platforms.push(this.physics.add.staticBody(750, 220, 200, 2)); // Platform 3
        
        // Add visuals for each platform
        // platforms.forEach(platform => {
        //     this.add.line(platform.x - platform.width/2, platform.y, 0, 0, platform.width, 0, 0x8B4513, 1).setLineWidth(2);
        // });

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
        
        // Create player sprite (blue rectangle) at server's initial position
        const sprite = this.add.rectangle(player.x, player.y, 24, 48, 0x0066ff).setOrigin(0, 0);
        sprite.setStrokeStyle(2, 0xffffff);
        
        this.playerSprites.set(sessionId, sprite);

        // Listen for changes to this specific player
        (player as any).onChange(() => {
          console.log(`Player ${sessionId} position update: x=${player.x}, y=${player.y}, left=${player.movingLeft}, right=${player.movingRight}`);
          
          // Update sprite position based on server data
          sprite.setPosition(player.x, player.y);
          
          // Change color based on movement
          if (player.movingLeft) {
            sprite.setFillStyle(0xff0000); // Red when moving left
          } else if (player.movingRight) {
            sprite.setFillStyle(0x00ff00); // Green when moving right
          } else {
            sprite.setFillStyle(0x0066ff); // Blue when idle
          }
        });
      });

      // When a player is removed
      this.room.state.players.onRemove((_player: SimplePlayer, sessionId: string) => {
        console.log('Player removed:', sessionId);
        
        const sprite = this.playerSprites.get(sessionId);
        if (sprite) {
          sprite.destroy();
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