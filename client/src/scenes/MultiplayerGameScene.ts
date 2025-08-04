import { Scene } from 'phaser';
import { Client, Room } from 'colyseus.js';
import { Player } from '../sprites/Player';
import { Bullet } from '../sprites/Bullet';

export class MultiplayerGameScene extends Scene {
  private room?: Room;
  private localPlayer?: Player;
  private otherPlayers: Map<string, Player> = new Map();
  private playerTargets: Map<string, { x: number, y: number }> = new Map();
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: any;
  private bullets: Map<string, Bullet> = new Map();
  private shootKey?: Phaser.Input.Keyboard.Key;
  private readonly INTERPOLATION_FACTOR = 0.6; // Smoothing factor (0-1) 0.1 is the smoothest, 1 is the least smooth

  private deathDialog?: Phaser.GameObjects.Container;
  private isDead: boolean = false;

  constructor() {
    super({ key: 'MultiplayerGameScene' });
  }

  preload() {
    // Load assets
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.spritesheet('player', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
    this.load.image('bullet', 'https://labs.phaser.io/assets/sprites/bullet.png');
  }

  async create() {
    // Create platforms
    this.platforms = this.physics.add.staticGroup();
    // center, height, 0,0,width,0, color
    // Ground
    this.add.line(400, 400, 0, 0, 800, 0, 0x0000ff);
    this.add.line(400, 250, 0, 0, 200, 0, 0x0000ff);


    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,S,A,D');
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);

    // Create quit button
    this.add.text(16, 16, 'Quit', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#ff0000',
      padding: { x: 10, y: 5 }
    })
    .setInteractive()
    .setScrollFactor(0)
    .setDepth(1000)
    .on('pointerdown', () => {
      this.quitToMenu();
    });

    // Add height ruler for debugging
    this.addHeightRuler();

    // Connect to Colyseus server
    try {
      const client = new Client('ws://localhost:2567');
      this.room = await client.joinOrCreate('game');
      console.log("Connected to room:", this.room.sessionId);
      this.setupRoomHandlers();

    } catch (error) {
      console.error("Could not connect to server:", error);
    }
  }

  update() {
    if (!this.room || !this.cursors || !this.localPlayer || this.isDead) return;

    // Handle movement input
    const moveInput = {
      left: this.wasd.A.isDown || this.cursors.left.isDown,
      right: this.wasd.D.isDown || this.cursors.right.isDown
    };
    this.room.send("move", moveInput);

    // Check for jump input - no physics checking needed, server handles validation
    if (Phaser.Input.Keyboard.JustDown(this.wasd.W) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      console.log("Sending jump request");
      this.room.send("jump");
    }

    // Check for shoot input
    if (this.shootKey && Phaser.Input.Keyboard.JustDown(this.shootKey)) {
      console.log("Sending shoot request");
      this.room.send("shoot");
    }

    // Interpolate all player positions
    this.playerTargets.forEach((target, sessionId) => {
      const player = sessionId === this.room?.sessionId 
        ? this.localPlayer 
        : this.otherPlayers.get(sessionId);
      
      if (player) {
        // Always interpolate X position smoothly
        player.x = Phaser.Math.Interpolation.Linear([player.x, target.x], this.INTERPOLATION_FACTOR);
        
        // For Y position, use lerp for both jumping and falling
        player.y = Phaser.Math.Interpolation.Linear([player.y, target.y], this.INTERPOLATION_FACTOR);
      }
    });
  }

  private showDeathDialog() {
    this.isDead = true;
    
    // Create semi-transparent overlay
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    // Create dialog container
    this.deathDialog = this.add.container(400, 300);
    this.deathDialog.setScrollFactor(0);
    this.deathDialog.setDepth(2001);

    // Death message
    const deathText = this.add.text(0, -50, 'You Died!', {
      fontSize: '48px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Restart button
    const restartButton = this.add.text(0, 20, 'Restart', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#00aa00',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
      this.restartGame();
    });

    // Quit button
    const quitButton = this.add.text(0, 80, 'Quit to Menu', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#aa0000',
      padding: { x: 20, y: 10 }
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
      this.quitToMenu();
    });

    this.deathDialog.add([deathText, restartButton, quitButton]);
  }

  private async restartGame() {
    // Clean up existing game state
    this.isDead = false;
    
    // Clean up death dialog and overlay
    if (this.deathDialog) {
      this.deathDialog.destroy();
      this.deathDialog = undefined;
    }
    this.children.getAll().forEach(child => {
      if (child instanceof Phaser.GameObjects.Rectangle && child.depth === 2000) {
        child.destroy();
      }
    });

    // Clean up existing players and bullets
    this.otherPlayers.forEach(player => player.destroy());
    this.otherPlayers.clear();
    this.bullets.forEach(bullet => bullet.destroy());
    this.bullets.clear();
    this.playerTargets.clear();
    
    if (this.localPlayer) {
      this.localPlayer.destroy();
      this.localPlayer = undefined;
    }

    // Leave current room before rejoining
    if (this.room) {
      this.room.leave();
    }

    // Rejoin the game
    try {
      const client = new Client('ws://localhost:2567');
      this.room = await client.joinOrCreate('game');
      console.log("Rejoined room:", this.room.sessionId);
      this.setupRoomHandlers();
    } catch (error) {
      console.error("Could not rejoin:", error);
      this.scene.start('MenuScene');
    }
  }

  private setupRoomHandlers() {
    if (!this.room) return;

    // Handle bullet messages from server
    this.room.onMessage("bulletCreate", (data: any) => {
      const bullet = new Bullet(this, data.x, data.y);
      bullet.setTint(0xff0000); // Red color
      bullet.body.setEnable(false); // Disable physics, server controls position
      this.bullets.set(data.id, bullet);
    });

    this.room.onMessage("bulletUpdate", (data: any) => {
      const bullet = this.bullets.get(data.id);
      if (bullet) {
        bullet.x = data.x;
        bullet.y = data.y;
      }
    });

    this.room.onMessage("bulletDestroy", (data: any) => {
      const bullet = this.bullets.get(data.id);
      if (bullet) {
        bullet.destroy();
        this.bullets.delete(data.id);
      }
    });

    // Handle player death
    this.room.onMessage("playerDeath", (data: any) => {
      if (data.playerId === this.room?.sessionId) {
        // Local player died
        this.showDeathDialog();
      }
    });

    // Handle room state changes
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      if (sessionId === this.room?.sessionId) {
        // This is our local player
        this.localPlayer = new Player(this, player.x, player.y);
        // Keep physics body for debug display but disable gravity and movement effects
        this.localPlayer.body.setAllowGravity(false);
        this.localPlayer.body.setVelocity(0, 0);
        this.localPlayer.body.setImmovable(true);
        this.playerTargets.set(sessionId, { x: player.x, y: player.y });
      } else {
        // This is another player
        const otherPlayer = new Player(this, player.x, player.y);
        this.otherPlayers.set(sessionId, otherPlayer);
        // Keep physics body for debug display but disable gravity and movement effects
        otherPlayer.body.setAllowGravity(false);
        otherPlayer.body.setVelocity(0, 0);
        otherPlayer.body.setImmovable(true);
        this.playerTargets.set(sessionId, { x: player.x, y: player.y });
      }

      // Listen for state changes
      player.onChange(() => {
        const targetPlayer = sessionId === this.room?.sessionId 
          ? this.localPlayer 
          : this.otherPlayers.get(sessionId);
        
        if (targetPlayer) {
          // Update animation based on velocity
          if (Math.abs(player.velocityX) < 0.1) {
            // Stop animation when not moving
            targetPlayer.anims.stop();
            // Set frame based on facing direction
            if (player.facingDirection > 0) {
              targetPlayer.setFrame(5); // First frame of right animation
            } else {
              targetPlayer.setFrame(0); // First frame of left animation
            }
          } else if (player.velocityX > 0) {
            targetPlayer.anims.play('right', true);
          } else if (player.velocityX < 0) {
            targetPlayer.anims.play('left', true);
          }
          
          // Update target position for interpolation
          this.playerTargets.set(sessionId, { x: player.x, y: player.y });
        }
      });
    });

    // Handle player removal
    this.room.state.players.onRemove((player: any, sessionId: string) => {
      console.log(`Player ${sessionId} removed from game state`);
      
      // Check if it's the local player
      if (sessionId === this.room?.sessionId) {
        if (this.localPlayer) {
          this.localPlayer.destroy();
          this.localPlayer = undefined;
        }
      } else {
        // It's another player
        const otherPlayer = this.otherPlayers.get(sessionId);
        if (otherPlayer) {
          otherPlayer.destroy();
          this.otherPlayers.delete(sessionId);
        }
      }
      this.playerTargets.delete(sessionId);
    });
  }

  private addHeightRuler() {
    // Create vertical ruler on the left side
    const rulerX = 50;
    
    // Draw ruler line
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff);
    graphics.moveTo(rulerX, 0);
    graphics.lineTo(rulerX, 600);
    graphics.stroke();
    graphics.setScrollFactor(0);
    graphics.setDepth(999);
    
    // Add height markers every 50 pixels
    for (let y = 0; y <= 600; y += 50) {
      // Tick mark
      graphics.lineStyle(2, 0xffffff);
      graphics.moveTo(rulerX - 5, y);
      graphics.lineTo(rulerX + 5, y);
      graphics.stroke();
      
      // Y coordinate label
      this.add.text(rulerX + 10, y - 10, `${y}`, {
        fontSize: '12px',
        color: '#ffffff'
      })
      .setScrollFactor(0)
      .setDepth(999);
    }
    
    // Add platform height indicators (will be updated when platforms are created)
    this.add.text(rulerX + 15, 568 - 10, '← Ground (568)', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    })
    .setScrollFactor(0)
    .setDepth(999);
    
    this.add.text(rulerX + 15, 400 - 10, '← Platform (400)', {
      fontSize: '14px',
      color: '#ffff00',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    })
    .setScrollFactor(0)
    .setDepth(999);
    
    this.add.text(rulerX + 15, 250 - 10, '← Platform (250)', {
      fontSize: '14px',
      color: '#ffff00',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    })
    .setScrollFactor(0)
    .setDepth(999);
    
    this.add.text(rulerX + 15, 220 - 10, '← Platform (220)', {
      fontSize: '14px',
      color: '#ffff00',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    })
    .setScrollFactor(0)
    .setDepth(999);
    
    this.add.text(rulerX + 15, 450 - 10, '← Player Spawn (450)', {
      fontSize: '14px',
      color: '#ff0000',
      backgroundColor: '#000000',
      padding: { x: 2, y: 2 }
    })
    .setScrollFactor(0)
    .setDepth(999);
  }

  private async quitToMenu() {
    if (this.room) {
      // Send quit message to server for immediate cleanup
      this.room.send("quitGame");
      
      // Wait a moment for server to process and broadcast the state change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then leave the room
      this.room.leave();
    }
    this.scene.start('MenuScene');
  }
}