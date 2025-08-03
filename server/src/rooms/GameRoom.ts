import { Room, Client } from '@colyseus/core';
import { GameState } from './schema/GameState';
import { PlayerState } from './schema/PlayerState';

export class GameRoom extends Room<GameState> {
  maxClients = 4;
  
  private playerColors: number[] = [
    0xff0000, // Red
    0x00ff00, // Green
    0x0000ff, // Blue  
    0xffff00, // Yellow
    0xff00ff, // Magenta
    0x00ffff, // Cyan
    0xff8000, // Orange
    0x8000ff, // Purple
  ];
  private usedColors: Set<number> = new Set();

  onCreate() {
    console.log("GameRoom created!");
    this.setState(new GameState());

    // Handle player movement
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      console.log(`Player ${client.sessionId} moved:`, data);
      player.x = data.x;
      player.y = data.y;
      player.facingDirection = data.facingDirection;
      player.isMoving = data.isMoving;
    });

    // Handle player shooting
    this.onMessage("shoot", (client, data) => {
      console.log(`Player ${client.sessionId} shot!`);
      // Broadcast shooting event to all clients except the shooter
      this.broadcast("playerShot", {
        playerId: client.sessionId,
        x: data.x,
        y: data.y,
        direction: data.direction
      }, { except: client });
    });

    // Handle player elimination
    this.onMessage("playerEliminated", (client, data) => {
      console.log(`Player ${data.eliminatedPlayerId} was eliminated by ${data.eliminatorId}`);
      
      // Remove the eliminated player from the game state
      const eliminatedPlayer = this.state.players.get(data.eliminatedPlayerId);
      if (eliminatedPlayer) {
        this.usedColors.delete(eliminatedPlayer.color);
        this.state.players.delete(data.eliminatedPlayerId);
      }

      // Broadcast elimination to all clients
      this.broadcast("playerEliminated", {
        eliminatedPlayerId: data.eliminatedPlayerId,
        eliminatorId: data.eliminatorId
      });
    });
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined!`);
    
    // Create a new player state
    const player = new PlayerState();
    player.x = 100 + Math.random() * 100; // Random spawn position
    player.y = 450;
    player.color = this.getUniqueColor(); // Assign unique color
    
    // Add the player to the game state
    this.state.players.set(client.sessionId, player);
    
    console.log(`Total players: ${this.state.players.size}, Player color: 0x${player.color.toString(16)}`);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left!`);
    
    // Free up the player's color
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.usedColors.delete(player.color);
    }
    
    // Remove the player from the game state
    this.state.players.delete(client.sessionId);
    console.log(`Total players: ${this.state.players.size}`);
  }

  private getUniqueColor(): number {
    // First player gets the original white color
    if (this.state.players.size === 0) {
      return 0xffffff; // White color for first player
    }
    
    // Find an unused color from the palette for other players
    for (const color of this.playerColors) {
      if (!this.usedColors.has(color)) {
        this.usedColors.add(color);
        return color;
      }
    }
    
    // If all colors are used, generate a random color
    const randomColor = Math.floor(Math.random() * 0xffffff);
    this.usedColors.add(randomColor);
    return randomColor;
  }
}