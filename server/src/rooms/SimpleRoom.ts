import { Room, Client } from '@colyseus/core';
import { SimpleGameState } from './schema/SimpleGameState';
import { SimplePlayerState } from './schema/SimplePlayerState';
import { ArcadePhysics } from 'arcade-physics';

export class SimpleRoom extends Room<SimpleGameState> {
  maxClients = 4;

  private readonly MOVE_SPEED = 200; // pixels per second
  private readonly JUMP_SPEED = 400; // pixels per second
  private readonly GROUND_Y = 500; // Adjusted to match visual ground position
  private readonly PLAYER_WIDTH = 32;
  private readonly PLAYER_HEIGHT = 48;
  private readonly GROUND_HEIGHT = 100;

  // Arcade Physics objects
  private physics!: ArcadePhysics;
  private platforms: any[] = [];
  private playerBodies: Map<string, any> = new Map();

  onCreate() {
    console.log("SimpleRoom created!");
    this.setState(new SimpleGameState());

    // Initialize Arcade Physics
    this.physics = new ArcadePhysics({
      width: 800,
      height: 600,
      gravity: { x: 0, y: 600 } // Add realistic gravity
    });

    
    // Create platforms
    this.platforms.push(this.physics.add.staticBody(0, 500, 800, 2)); // Ground
    this.platforms.push(this.physics.add.staticBody(600, 400, 200, 2)); // Platform 1
    this.platforms.push(this.physics.add.staticBody(50, 250, 200, 2));  // Platform 2
    this.platforms.push(this.physics.add.staticBody(750, 220, 200, 2)); // Platform 3
    

    // Server physics update at 60 FPS
    this.setSimulationInterval(() => this.updatePhysics(), 1000/60);

    // Handle input messages
    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        console.log(`No player found for session: ${client.sessionId}`);
        return;
      }

      player.movingLeft = data.left || false;
      player.movingRight = data.right || false;
      
      // Handle jumping - only allow jump if player is on ground
      const playerBody = this.playerBodies.get(client.sessionId);
      if (data.jump && playerBody) {
        // Check if player is touching any platform
        let canJump = false;
        this.platforms.forEach(platform => {
          if (playerBody.touching.down || playerBody.blocked.down) {
            canJump = true;
          }
        });
        
        if (canJump) {
          playerBody.setVelocityY(-this.JUMP_SPEED);
          console.log(`Player ${client.sessionId} jumped!`);
        }
      }
      
      if (data.left || data.right || data.jump) {
        console.log(`Player ${client.sessionId} input: left=${data.left}, right=${data.right}, jump=${data.jump}`);
      }
    });
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined SimpleRoom!`);
    
    const player = new SimplePlayerState();
    
    // Create physics body for player at initial spawn position
    const playerBody = this.physics.add.body(500, 400, 24, 48);
    this.playerBodies.set(client.sessionId, playerBody);

    // Set initial player state and physics body properties
    playerBody.bounce.set(0, 0);
    playerBody.collideWorldBounds = true;
    
    // Update player state to match physics body position
    // Store top-left position for client (origin 0,0)
    player.x = playerBody.x;
    player.y = playerBody.y;
    player.movingLeft = false;
    player.movingRight = false;
    
    this.state.players.set(client.sessionId, player);
    console.log(`Player spawned at x=${player.x}, y=${player.y}`);
  }

  onLeave(client: Client) {
    console.log(`Player ${client.sessionId} left SimpleRoom!`);
    
    // Remove physics body
    const playerBody = this.playerBodies.get(client.sessionId);
    if (playerBody) {
      this.physics.world.remove(playerBody);
      this.playerBodies.delete(client.sessionId);
    }
    
    this.state.players.delete(client.sessionId);
  }

  private updatePhysics() {
    // Step the physics simulation forward
    this.physics.world.update(16.666, 16.666); // Update at 60fps (1000/60 ≈ 16.666ms)

    this.state.players.forEach((player, sessionId) => {
      const playerBody = this.playerBodies.get(sessionId);
      if (!playerBody) return;

      // Apply horizontal movement forces
      if (player.movingLeft) {
        playerBody.setVelocityX(-this.MOVE_SPEED);
      } else if (player.movingRight) {
        playerBody.setVelocityX(this.MOVE_SPEED);
      } else {
        // Apply friction when not moving
        playerBody.setVelocityX(playerBody.velocity.x * 0.9);
      }

      // Add collision between player and all platforms
      this.platforms.forEach(platform => {
        this.physics.world.collide(playerBody, platform);
      });

      // Update player state from physics body
      player.x = playerBody.x;
      player.y = playerBody.y;

      // Keep player on screen
      if (player.x < 0) {
        player.x = 0;
        playerBody.x = 0;
      }
      if (player.x > 800) {
        player.x = 800;
        playerBody.x = 800;
      }
    });
  }
}