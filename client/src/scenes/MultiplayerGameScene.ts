import { Scene } from 'phaser';
import { Client, Room } from 'colyseus.js';
import { Player } from '../sprites/Player';

interface OtherPlayer extends Player {
  sessionId: string;
}

export class MultiplayerGameScene extends Scene {
  private player!: Player;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private shootKey!: Phaser.Input.Keyboard.Key;
  private room?: Room;
  private client?: Client;

  constructor() {
    super({ key: 'MultiplayerGameScene' });
  }

  preload() {
    // Load game assets
    this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    this.load.spritesheet('player', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
    this.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVBiVY/z//z8DJQAggJiYmBgZGRkZGBgYGFatWsVAKQAQQIxMTEwMf//+Zfjx4wfD379/GX7//s3w+/dvBkoAQAAxMjIyMvz584fh27dvDJ8/f2b48uULw5cvXxi+fv3K8P37dwZKAUAAYmRkZGT4+fMnw6dPnxg+fvzI8OHDB4b379+zf/nyhYFSABBAjIyMjAw/fvxg+PDhA8O7d+8Y3r59y/DmzRuG169fM7x69Yrh5cuXDJQCgABiZGRkZPjy5QvDy5cvGV68eMHw/PlzhqdPnzI8efKE4fHjxwyPHj1iePjwIQOlACCAGBkZGRmePXvG8OjRI4aHDx8yPHjwgOH+/fsM9+7dY7h79y7DnTt3GO7cucNAKQAIIEZGRkaGO3fuMNy5c4fh9u3bDLdu3WK4efMmw40bNxiuX7/OcO3aNYZr164xUAoAAoiRkZGR4dq1awzXrl1juHr1KsPVq1cZrly5wnD58mWGy5cvM1y6dImBUgAQQABxoK9zYQQAAAABJRU5ErkJggg==');
  }

  async create() {
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

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);

    // Connect to Colyseus server
    try {
      this.client = new Client('ws://localhost:2567');
      this.room = await this.client.joinOrCreate('game');
      
      // Handle room state changes
      this.room.state.players.onAdd((player, sessionId) => {
        if (sessionId !== this.room?.sessionId) {
          const otherPlayer = new Player(this, player.x, player.y) as OtherPlayer;
          otherPlayer.sessionId = sessionId;
          this.otherPlayers.set(sessionId, otherPlayer);
        }
      });

      this.room.state.players.onRemove((_, sessionId) => {
        const otherPlayer = this.otherPlayers.get(sessionId);
        if (otherPlayer) {
          otherPlayer.destroy();
          this.otherPlayers.delete(sessionId);
        }
      });

      // Listen for player movements
      this.room.state.players.onChange((player, sessionId) => {
        if (sessionId !== this.room?.sessionId) {
          const otherPlayer = this.otherPlayers.get(sessionId);
          if (otherPlayer) {
            otherPlayer.x = player.x;
            otherPlayer.y = player.y;
            otherPlayer.facingDirection = player.facingDirection;
            if (player.isMoving) {
              otherPlayer.anims.play(player.facingDirection > 0 ? 'right' : 'left', true);
            } else {
              otherPlayer.anims.play('turn');
            }
          }
        }
      });

      // Listen for shooting events
      this.room.onMessage("playerShot", (message) => {
        if (message.playerId !== this.room?.sessionId) {
          const otherPlayer = this.otherPlayers.get(message.playerId);
          if (otherPlayer) {
            const bullet = this.physics.add.sprite(message.x, message.y, 'bullet');
            bullet.setVelocityX(400 * message.direction);
            // Auto-destroy bullet after 2 seconds
            this.time.delayedCall(2000, () => bullet.destroy());
          }
        }
      });

    } catch (error) {
      console.error("Could not connect to server:", error);
    }

    // Add collision between all players and platforms
    this.physics.add.collider(this.player, this.platforms);
    this.otherPlayers.forEach(otherPlayer => {
      this.physics.add.collider(otherPlayer, this.platforms);
    });
  }

  update() {
    if (!this.player || !this.cursors || !this.room) return;

    // Handle player movement
    if (this.cursors.left.isDown) {
      this.player.moveLeft();
      this.sendPlayerState(true);
    } else if (this.cursors.right.isDown) {
      this.player.moveRight();
      this.sendPlayerState(true);
    } else {
      this.player.stop();
      this.sendPlayerState(false);
    }

    // Handle jumping
    const onGround = this.player.body && (this.player.body.touching.down || this.player.body.blocked.down);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
      this.player.jump();
    }

    // Handle shooting
    if (Phaser.Input.Keyboard.JustDown(this.shootKey)) {
      this.shoot();
    }
  }

  private sendPlayerState(isMoving: boolean) {
    if (!this.room) return;
    
    this.room.send("move", {
      x: this.player.x,
      y: this.player.y,
      facingDirection: this.player.facingDirection,
      isMoving
    });
  }

  private shoot() {
    if (!this.room) return;

    const spawnPos = this.player.getBulletSpawnPosition();
    const bullet = this.physics.add.sprite(spawnPos.x, spawnPos.y, 'bullet');
    bullet.setVelocityX(400 * this.player.facingDirection);

    // Send shoot event to server
    this.room.send("shoot", {
      x: spawnPos.x,
      y: spawnPos.y,
      direction: this.player.facingDirection
    });

    // Auto-destroy bullet after 2 seconds
    this.time.delayedCall(2000, () => bullet.destroy());
  }
}