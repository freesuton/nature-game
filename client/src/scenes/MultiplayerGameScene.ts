import { Scene } from 'phaser';
import { Client, Room } from 'colyseus.js';
import { Player } from '../sprites/Player';

export class MultiplayerGameScene extends Scene {
  private room?: Room;
  private localPlayer?: Player;
  private otherPlayers: Map<string, Player> = new Map();
  private platforms?: Phaser.Physics.Arcade.StaticGroup;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: any;

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
  }

  async create() {
    // Create platforms
    this.platforms = this.physics.add.staticGroup();
    this.platforms.create(400, 540, 'ground').setScale(2).refreshBody();

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,S,A,D');

    // Connect to Colyseus server
    try {
      const client = new Client('ws://localhost:2567');
      this.room = await client.joinOrCreate('game');
      console.log("Connected to room:", this.room.sessionId);

      // Handle room state changes
      this.room.state.players.onAdd((player: any, sessionId: string) => {
        if (sessionId === this.room?.sessionId) {
          // This is our local player
          this.localPlayer = new Player(this, player.x, player.y);
          // Keep physics body for debug display but disable gravity and movement effects
          this.localPlayer.body.setAllowGravity(false);
          this.localPlayer.body.setVelocity(0, 0);
          this.localPlayer.body.setImmovable(true);
        } else {
          // This is another player
          const otherPlayer = new Player(this, player.x, player.y);
          this.otherPlayers.set(sessionId, otherPlayer);
          // Keep physics body for debug display but disable gravity and movement effects
          otherPlayer.body.setAllowGravity(false);
          otherPlayer.body.setVelocity(0, 0);
          otherPlayer.body.setImmovable(true);
        }

        // Listen for state changes
        player.onChange(() => {
          const targetPlayer = sessionId === this.room?.sessionId 
            ? this.localPlayer 
            : this.otherPlayers.get(sessionId);
          
          if (targetPlayer) {
            // Update animation based on velocity
            if (Math.abs(player.velocityX) < 0.1) {
              targetPlayer.anims.play('turn');
            } else if (player.velocityX > 0) {
              targetPlayer.anims.play('right', true);
            } else {
              targetPlayer.anims.play('left', true);
            }
            
            // Update position
            targetPlayer.x = player.x;
            targetPlayer.y = player.y;
          }
        });
      });

      // Handle player removal
      this.room.state.players.onRemove((player: any, sessionId: string) => {
        const otherPlayer = this.otherPlayers.get(sessionId);
        if (otherPlayer) {
          otherPlayer.destroy();
          this.otherPlayers.delete(sessionId);
        }
      });

    } catch (error) {
      console.error("Could not connect to server:", error);
    }
  }

  update() {
    if (!this.room || !this.cursors || !this.localPlayer) return;

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
  }
}