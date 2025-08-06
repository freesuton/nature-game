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
          debug: false
        }
      }
    });
  }

  create() {
    console.log('SimpleScene created');

    // Create ground with both visual and physics
    const ground = this.add.rectangle(400, 500, 800, 100, 0x8B4513); // Brown ground visual
    this.physics.add.existing(ground, true); // Add static physics to match server
    
    // Add UI text
    this.add.text(10, 10, 'Simple Game - Server Physics', { 
      fontSize: '16px', 
      color: '#000000' 
    });
    this.add.text(10, 30, 'WASD to move, M for Menu', { 
      fontSize: '14px', 
      color: '#000000' 
    });

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
        
        // Create player sprite (blue rectangle)
        const sprite = this.add.rectangle(player.x, player.y, 32, 48, 0x0066ff);
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

    if (leftPressed || rightPressed) {
      console.log(`Sending input: left=${leftPressed}, right=${rightPressed}`);
      this.room.send('move', {
        left: leftPressed,
        right: rightPressed
      });
    } else {
      this.room.send('move', {
        left: false,
        right: false
      });
    }
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