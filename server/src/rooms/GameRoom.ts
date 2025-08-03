import { Room, Client } from '@colyseus/core';
import { GameState } from './schema/GameState';
import { PlayerState } from './schema/PlayerState';

export class GameRoom extends Room<GameState> {
  maxClients = 4;

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
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined!`);
    
    // Create a new player state
    const player = new PlayerState();
    player.x = 100 + Math.random() * 100; // Random spawn position
    player.y = 450;
    
    // Add the player to the game state
    this.state.players.set(client.sessionId, player);
    
    console.log(`Total players: ${this.state.players.size}`);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left!`);
    // Remove the player from the game state
    this.state.players.delete(client.sessionId);
    console.log(`Total players: ${this.state.players.size}`);
  }
}