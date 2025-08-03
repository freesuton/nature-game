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
  private readonly BULLET_SPEED: number = 1000;
  
  private bullets: Map<string, { x: number, y: number, velocityX: number, ownerId: string }> = new Map();
  private bulletId: number = 0;

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
        player.facingDirection = -1;
      } else if (data.right && !data.left) {
        player.velocityX = this.MOVE_SPEED;
        player.facingDirection = 1;
      } else {
        player.velocityX = 0;
      }
    });

    // Handle shoot requests
    this.onMessage("shoot", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Create bullet on server
      const direction = player.facingDirection;
      const bulletData = {
        x: player.x + (direction * 20), // Spawn in front of player
        y: player.y - 5,
        velocityX: this.BULLET_SPEED * direction,
        ownerId: client.sessionId
      };

      const bulletIdStr = this.bulletId.toString();
      this.bullets.set(bulletIdStr, bulletData);
      this.bulletId++;

      // Broadcast bullet creation to all clients
      this.broadcast("bulletCreate", {
        id: bulletIdStr,
        ...bulletData
      });

      console.log(`Player ${client.sessionId} shot a bullet!`);
    });

    // Handle quit button clicks
    this.onMessage("quitGame", (client) => {
      console.log(`Player ${client.sessionId} clicked quit button - cleaning up all data`);
      
      // Remove player from game state immediately
      const wasRemoved = this.state.players.delete(client.sessionId);
      console.log(`Player removal result: ${wasRemoved}`);
      
      // Clean up any bullets owned by this player
      let bulletsRemoved = 0;
      this.bullets.forEach((bullet, bulletId) => {
        if (bullet.ownerId === client.sessionId) {
          this.bullets.delete(bulletId);
          this.broadcast("bulletDestroy", { id: bulletId });
          bulletsRemoved++;
        }
      });
      
      if (bulletsRemoved > 0) {
        console.log(`Removed ${bulletsRemoved} bullets owned by ${client.sessionId}`);
      }
      
      console.log(`Player ${client.sessionId} completely removed from game. Remaining players: ${this.state.players.size}`);
      
      // Force state synchronization
      this.broadcastPatch();
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
    
    // Remove player from game state
    this.state.players.delete(client.sessionId);
    
    // Clean up any bullets owned by this player
    this.bullets.forEach((bullet, bulletId) => {
      if (bullet.ownerId === client.sessionId) {
        this.bullets.delete(bulletId);
        this.broadcast("bulletDestroy", { id: bulletId });
      }
    });
    
    console.log(`Player ${client.sessionId} left - remaining players: ${this.state.players.size}`);
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

    // Update bullets
    this.bullets.forEach((bullet, bulletId) => {
      // Update position
      bullet.x += bullet.velocityX * deltaTime;

      // Check for world bounds
      if (bullet.x < -50 || bullet.x > 850) {
        this.bullets.delete(bulletId);
        this.broadcast("bulletDestroy", { id: bulletId });
        return;
      }

      // Check for collisions with players
      this.state.players.forEach((player, playerId) => {
        if (playerId !== bullet.ownerId) { // Don't hit self
          const dx = Math.abs(bullet.x - player.x);
          const dy = Math.abs(bullet.y - player.y);
          if (dx < 20 && dy < 30) { // Simple box collision
            // Hit! Remove bullet and remove player
            this.bullets.delete(bulletId);
            this.broadcast("bulletDestroy", { id: bulletId });
            
            // Notify player death
            this.broadcast("playerDeath", { 
              playerId: playerId,
              killedBy: bullet.ownerId 
            });
            
            // Remove the player from the game
            this.state.players.delete(playerId);
            console.log(`Player ${playerId} was killed by ${bullet.ownerId}`);
          }
        }
      });

      // Broadcast bullet position update
      this.broadcast("bulletUpdate", {
        id: bulletId,
        x: bullet.x,
        y: bullet.y
      });
    });
  }
}