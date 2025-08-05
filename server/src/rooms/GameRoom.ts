import { Room, Client } from '@colyseus/core';
import { GameState } from './schema/GameState';
import { PlayerState } from './schema/PlayerState';
import * as planck from 'planck';

export class GameRoom extends Room<GameState> {
  maxClients = 4;

  // Physics constants
  private readonly GRAVITY: number = 800;
  private readonly JUMP_FORCE: number = -650;
  private readonly MOVE_SPEED: number = 160;
  private readonly BULLET_SPEED: number = 1000;
  
  // Character dimensions
  private readonly PLAYER_HEIGHT: number = 48; // Player sprite height
  private readonly GROUND_PLATFORM_Y: number = 400; // Platform center position
  private readonly GROUND_Y: number = this.GROUND_PLATFORM_Y - this.PLAYER_HEIGHT / 2; // Where player stands
  
  private bullets: Map<string, { x: number, y: number, velocityX: number, ownerId: string }> = new Map();
  private bulletId: number = 0;

  // Planck.js physics world and bodies
  private world!: planck.World;
  private playerBodies: Map<string, planck.Body> = new Map();
  private platformBodies: planck.Body[] = [];

  onCreate() {
    console.log("GameRoom created!");
    this.setState(new GameState());
    
    // Initialize planck.js physics world
    this.world = planck.World({
      gravity: planck.Vec2(0, 0) // We'll handle gravity ourselves for better jump control
    });

    // Create static platforms
    this.createPlatforms();
    
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
    
    // Set spawn position based on ground platform and player height
    player.x = 100;
    player.y = this.GROUND_Y; // Dynamically calculated position
    player.onGround = true;

    // Create physics body for player
    const playerBody = this.world.createBody({
      type: 'dynamic',
      position: planck.Vec2(player.x, player.y),
      fixedRotation: true
    });
    
    playerBody.createFixture({
      shape: planck.Box(16, 16), // Half-width, half-height (32x48 total)
      density: 1.0,
      friction: 0.3
    });
    
    // Store the body reference
    this.playerBodies.set(client.sessionId, playerBody);
    
    // Add the player to the game state
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left!`);
    
    // Remove physics body
    const playerBody = this.playerBodies.get(client.sessionId);
    if (playerBody) {
      this.world.destroyBody(playerBody);
      this.playerBodies.delete(client.sessionId);
    }
    
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

  private createPlatforms() {
    // Ground platform
    const groundBody = this.world.createBody({
      type: 'static',
      position: planck.Vec2(400, this.GROUND_PLATFORM_Y+8)
    });
    groundBody.createFixture({
      shape: planck.Box(400, 16), // Half-width, half-height
      friction: 0.3
    });
    this.platformBodies.push(groundBody);

    // Sky platform
    const skyBody = this.world.createBody({
      type: 'static',
      position: planck.Vec2(400, 258)
    });
    skyBody.createFixture({
      shape: planck.Box(100, 16), // Half-width, half-height
      friction: 0.3
    });
    this.platformBodies.push(skyBody);
  }

  private updatePhysics() {
    const deltaTime = 1/60; // Fixed timestep for physics

    // Update each player's physics
    this.state.players.forEach((player, sessionId) => {
      const playerBody = this.playerBodies.get(sessionId);
      if (!playerBody) return;

      // Apply gravity if not on ground
      if (!player.onGround) {
        player.velocityY += this.GRAVITY * deltaTime;
      }

      // Update position directly
      player.x += player.velocityX * deltaTime;
      player.y += player.velocityY * deltaTime;
      
      // Update physics body position for collision detection only
      playerBody.setPosition(planck.Vec2(player.x, player.y));
      
      // Step the physics world for collision detection
      this.world.step(deltaTime);

      // No need to get position from physics body since we're updating it directly

      // Check for ground contact using Planck.js collision detection
      let isOnGround = false;
      for (let ce = playerBody.getContactList(); ce; ce = ce.next) {
        const contact = ce.contact;
        if (!contact) continue;
        
        const other = ce.other;
        // Check if the contact is with a platform
        if (other && this.platformBodies.includes(other)) {
          const manifold = contact.getManifold();
                // Check if the contact normal is pointing upward (we're on top)
      if (manifold.localNormal.y < -0.5) {
        isOnGround = true;
        // Adjust position to exactly stand on platform
        const platformPos = other.getPosition();
        const platformHeight = (other === this.platformBodies[0]) ? 16 : 16; // Both platforms now have height 16
        player.y = platformPos.y - platformHeight - 16; // 16 is half of player height
        break;
          }
        }
      }

      // Update ground state
      if (isOnGround && player.velocityY >= 0) {
        player.onGround = true;
        player.velocityY = 0;
      } else {
        player.onGround = false;
      }

      // World bounds for x
      if (player.x < 16) {
        player.x = 16;
        playerBody.setPosition(planck.Vec2(16, player.y));
      }
      if (player.x > 784) {
        player.x = 784;
        playerBody.setPosition(planck.Vec2(784, player.y));
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