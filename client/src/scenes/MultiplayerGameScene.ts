import { Scene } from 'phaser';
import { Client, Room } from 'colyseus.js';
import { Player } from '../sprites/Player';
import { GameLogic, GameState } from '../utils/GameLogic';

interface OtherPlayer extends Player {
  sessionId: string;
  targetX: number;
  targetY: number;
  smoothX: number;
  smoothY: number;
}

export class MultiplayerGameScene extends Scene {
  private gameState!: GameState;
  private otherPlayers: Map<string, OtherPlayer> = new Map();
  private room?: Room;
  private client?: Client;


  constructor() {
    super({ key: 'MultiplayerGameScene' });
  }

  preload() {
    GameLogic.preloadAssets(this);
  }

  async create() {
    // Create base game world using shared logic
    this.gameState = GameLogic.createWorld(this);

    // Connect to Colyseus server
    try {
      // Use environment variable or fallback for server URL
      const serverUrl = 'ws://192.168.0.222:2567';
      console.log('Attempting to connect to server at:', serverUrl);
      
      this.client = new Client(serverUrl);
      
      console.log('Client created, attempting to join room...');
      
      this.room = await this.client.joinOrCreate('game');
      console.log('Successfully joined room!');
      
      // Handle room state changes
      this.room.state.players.onAdd((player: any, sessionId: string) => {
        if (sessionId !== this.room?.sessionId) {
          // Use server-assigned color
          const otherPlayer = new Player(this, player.x, player.y, player.color) as OtherPlayer;
          otherPlayer.sessionId = sessionId;
          otherPlayer.targetX = player.x;
          otherPlayer.targetY = player.y;
          otherPlayer.smoothX = player.x;
          otherPlayer.smoothY = player.y;
          this.otherPlayers.set(sessionId, otherPlayer);
          this.physics.add.collider(otherPlayer, this.gameState.platforms);
          
          // Listen to changes on this specific player
          player.onChange(() => {
            const currentOtherPlayer = this.otherPlayers.get(sessionId);
            if (currentOtherPlayer) {
              // Set new target positions instead of directly setting position
              currentOtherPlayer.targetX = player.x;
              currentOtherPlayer.targetY = player.y;
              currentOtherPlayer.facingDirection = player.facingDirection;
              if (player.isMoving) {
                currentOtherPlayer.anims.play(player.facingDirection > 0 ? 'right' : 'left', true);
              } else {
                currentOtherPlayer.anims.play('turn');
              }
            }
          });
        } else {
          // This is the local player - apply the server-assigned color
          this.gameState.player.setTint(player.color);
        }
      });

      this.room.state.players.onRemove((_: any, sessionId: string) => {
        const otherPlayer = this.otherPlayers.get(sessionId);
        if (otherPlayer) {
          otherPlayer.destroy();
          this.otherPlayers.delete(sessionId);
        }
      });

      // Listen for shooting events
      this.room.onMessage("playerShot", (message) => {
        if (message.playerId !== this.room?.sessionId) {
          const otherPlayer = this.otherPlayers.get(message.playerId);
          if (otherPlayer) {
            // Use the same bullet system as single player
            const bullet = this.gameState.bullets.get(message.x, message.y);
            if (bullet) {
              bullet.fire(message.x, message.y, message.direction);
            }
          }
        }
      });

    } catch (error) {
      console.error("Could not connect to server:", error);
      // Show error message in game
      this.add.text(16, 16, 'Failed to connect to server!\nCheck console for details', {
        fontSize: '18px',
        backgroundColor: '#ff0000',
        padding: { x: 10, y: 5 }
      });
    }
  }

  update() {
    if (!this.room) return;
    
    // Use shared game logic with multiplayer callbacks
    GameLogic.handleMovement(
      this.gameState,
      () => this.sendPlayerState(true),  // onMove
      () => this.sendPlayerState(false), // onStop
      () => {}                           // onJump (no special handling needed)
    );
    
    GameLogic.handleShooting(
      this.gameState, 
      this, 
      (x, y, direction) => this.sendShootEvent(x, y, direction)
    );

    // Smooth interpolation for other players
    this.otherPlayers.forEach(otherPlayer => {
      const distanceX = Math.abs(otherPlayer.targetX - otherPlayer.smoothX);
      const distanceY = Math.abs(otherPlayer.targetY - otherPlayer.smoothY);
      
      // If very close to target, snap to it to prevent sliding
      if (distanceX < 1 && distanceY < 1) {
        otherPlayer.smoothX = otherPlayer.targetX;
        otherPlayer.smoothY = otherPlayer.targetY;
      } else {
        const lerpFactor = 0.2; // Slightly higher for responsiveness
        otherPlayer.smoothX += (otherPlayer.targetX - otherPlayer.smoothX) * lerpFactor;
        otherPlayer.smoothY += (otherPlayer.targetY - otherPlayer.smoothY) * lerpFactor;
      }
      
      // Apply smoothed position
      otherPlayer.x = otherPlayer.smoothX;
      otherPlayer.y = otherPlayer.smoothY;
    });
  }

  private sendPlayerState(isMoving: boolean) {
    if (!this.room) return;
    
    this.room.send("move", {
      x: this.gameState.player.x,
      y: this.gameState.player.y,
      facingDirection: this.gameState.player.facingDirection,
      isMoving
    });
  }

  private sendShootEvent(x: number, y: number, direction: number) {
    if (!this.room) return;
    
    this.room.send("shoot", {
      x,
      y,
      direction
    });
  }


}