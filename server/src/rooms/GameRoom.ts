import { Room, Client } from '@colyseus/core';
import { GameState } from './schema/GameState';
import { PlayerState } from './schema/PlayerState';

export class GameRoom extends Room<GameState> {
  maxClients = 4;

  // Physics constants
  private readonly GRAVITY: number = 800;
  private readonly JUMP_FORCE: number = -650;
  private readonly GROUND_Y: number = 450;
  private readonly MOVE_SPEED: number = 160;

  onCreate() {
    console.log("GameRoom created!");
    this.setState(new GameState());
    
    // Start physics simulation at 60 FPS
    this.setSimulationInterval(() => this.updatePhysics(), 1000/60);

    // Handle jump requests
    this.onMessage("jump", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.onGround) return; // Can only jump if on ground
      
      // Apply jump force
      player.velocityY = this.JUMP_FORCE;
      player.onGround = false;
      
      console.log(`Player ${client.sessionId} jumped!`);
    });

    // Handle movement input
    this.onMessage("move", (client, data: { left: boolean, right: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Set horizontal velocity based on input
      if (data.left && !data.right) {
        player.velocityX = -this.MOVE_SPEED;
      } else if (data.right && !data.left) {
        player.velocityX = this.MOVE_SPEED;
      } else {
        player.velocityX = 0;
      }
    });
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined!`);
    
    // Create a new player state
    const player = new PlayerState();
    
    // Add the player to the game state
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left!`);
    this.state.players.delete(client.sessionId);
  }

  private updatePhysics() {
    const deltaTime = 1/60; // Fixed timestep for physics

    // Update each player's physics
    this.state.players.forEach((player) => {
      // Apply gravity if not on ground
      if (!player.onGround) {
        player.velocityY += this.GRAVITY * deltaTime;
      }

      // Update position
      player.x += player.velocityX * deltaTime;
      player.y += player.velocityY * deltaTime;

      // World bounds for x
      if (player.x < 0) player.x = 0;
      if (player.x > 800) player.x = 800;

      // Ground collision
      if (player.y >= this.GROUND_Y) {
        player.y = this.GROUND_Y;
        player.velocityY = 0;
        player.onGround = true;
      }
    });
  }
}