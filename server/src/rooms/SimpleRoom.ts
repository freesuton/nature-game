import { Room, Client } from '@colyseus/core';
import { SimpleGameState } from './schema/SimpleGameState';
import { SimplePlayerState } from './schema/SimplePlayerState';
import { ArcadePhysics } from 'arcade-physics';

export class SimpleRoom extends Room<SimpleGameState> {
  maxClients = 4;

  private readonly MOVE_SPEED = 200; // pixels per second
  private readonly GROUND_Y = 500; // Adjusted to match visual ground position
  private readonly PLAYER_WIDTH = 32;
  private readonly PLAYER_HEIGHT = 48;
  private readonly GROUND_HEIGHT = 100;

  // Arcade Physics objects
  private physics!: ArcadePhysics;
  private ground: any;
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

    // Create ground platform
    this.ground = this.physics.add.staticBody(400, this.GROUND_Y, 800, this.GROUND_HEIGHT);

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
      
      if (data.left || data.right) {
        console.log(`Player ${client.sessionId} input: left=${data.left}, right=${data.right}`);
      }
    });
  }

  onJoin(client: Client) {
    console.log(`Player ${client.sessionId} joined SimpleRoom!`);
    
    const player = new SimplePlayerState();
    
    // Create physics body for player
    const playerBody = this.physics.add.body(400, this.GROUND_Y - this.GROUND_HEIGHT/2 - this.PLAYER_HEIGHT/2, this.PLAYER_WIDTH, this.PLAYER_HEIGHT);
    this.playerBodies.set(client.sessionId, playerBody);

    // Set initial player state and physics body properties
    playerBody.bounce.set(0.2, 0.2);
    playerBody.collideWorldBounds = true;
    
    // Set initial position (spawn in air)
    playerBody.position.set(400, 200);
    
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

      // Add collision between player and ground
      this.physics.world.collide(playerBody, this.ground);

      // Update player state from physics body
      player.x = playerBody.x;
      player.y = playerBody.y;

      // Keep player on screen
      if (player.x < 25) {
        player.x = 25;
        playerBody.x = 25;
      }
      if (player.x > 775) {
        player.x = 775;
        playerBody.x = 775;
      }
    });
  }
}