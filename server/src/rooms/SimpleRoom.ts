import { Room, Client } from '@colyseus/core';
import { SimpleGameState } from './schema/SimpleGameState';
import { SimplePlayerState } from './schema/SimplePlayerState';
import { GunState } from './schema/GunState';
import { ArcadePhysics } from 'arcade-physics';
import { SimpleMapConfig, Platform, getMapConfig, MapName, Maps, getRandomMapName } from '../../../MapConfig';

export class SimpleRoom extends Room<SimpleGameState> {
  maxClients = 4;

  private readonly MOVE_SPEED = 200; // pixels per second
  private readonly JUMP_SPEED = 400; // pixels per second
  private readonly PLAYER_WIDTH = 32;
  private readonly PLAYER_HEIGHT = 48;

  // Arcade Physics objects
  private physics!: ArcadePhysics;
  private platforms: any[] = [];
  private playerBodies: Map<string, any> = new Map();
  private currentMap: MapName = 'simple'; // Default map
  
  // Player color options
  private readonly playerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

  onCreate(options: any = {}) {
    console.log("SimpleRoom created with options:", options);
    this.setState(new SimpleGameState());

    // Map selection logic
    if (options?.mapName === 'random' || !options?.mapName) {
      // Select random map
      this.currentMap = getRandomMapName();
      console.log(`Random map selected: ${this.currentMap} (from ${Object.keys(Maps).join(', ')})`);
    } else if (options?.mapName && options.mapName in Maps) {
      // Use specified map
      this.currentMap = options.mapName as MapName;
      console.log(`Specific map requested: ${this.currentMap}`);
    }

    const mapConfig = getMapConfig(this.currentMap);
    console.log(`Loading map: ${mapConfig.name}`);

    // Initialize Arcade Physics using selected map config
    this.physics = new ArcadePhysics({
      width: mapConfig.width,
      height: mapConfig.height,
      gravity: mapConfig.gravity
    });

    // Create platforms from selected map config
    mapConfig.platforms.forEach((platformConfig: Platform) => {
      this.platforms.push(
        this.physics.add.staticBody(
          platformConfig.x, 
          platformConfig.y, 
          platformConfig.width, 
          platformConfig.height
        )
      );
    });
    
    // Spawn gun in center of ground
    this.spawnCenterGun();

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
      
      // Update facing direction based on movement
      if (data.left) {
        player.facingDirection = "left";
      } else if (data.right) {
        player.facingDirection = "right";
      }
      // Note: If not moving, keep the current facing direction
      
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
    
    // Send the current map info to the client
    client.send('mapInfo', { 
      mapName: this.currentMap,
      mapConfig: getMapConfig(this.currentMap)
    });
    
    const player = new SimplePlayerState();
    
    // Assign a unique color to the new player
    const assignedColor = this.getUniquePlayerColor();
    
    // Create physics body for player at initial spawn position
    const playerBody = this.physics.add.body(500, 400, 32, 48);
    this.playerBodies.set(client.sessionId, playerBody);

    // Set initial player state and physics body properties
    playerBody.bounce.set(0, 0);
    playerBody.collideWorldBounds = true;
    
    // Update player state to match physics body position and assign unique color
    // Store top-left position for client (origin 0,0)
    player.x = playerBody.x;
    player.y = playerBody.y;
    player.movingLeft = false;
    player.movingRight = false;
    player.color = assignedColor;
    player.facingDirection = "right"; // Default facing direction
    player.hasGun = false; // No gun initially
    
    this.state.players.set(client.sessionId, player);
    console.log(`Player spawned at x=${player.x}, y=${player.y} with unique color=${player.color}`);
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

    // Check gun pickups
    this.checkGunPickups();
  }

  private getUniquePlayerColor(): string {
    // Get currently used colors by existing players
    const usedColors = new Set<string>();
    this.state.players.forEach((existingPlayer) => {
      usedColors.add(existingPlayer.color);
    });
    
    // Find the first available color that's not already used
    let assignedColor = this.playerColors[0]; // Default fallback
    for (const color of this.playerColors) {
      if (!usedColors.has(color)) {
        assignedColor = color;
        break;
      }
    }
    
    // If all colors are used (more than 4 players), cycle through colors
    if (usedColors.has(assignedColor) && usedColors.size >= this.playerColors.length) {
      const playerIndex = this.state.players.size;
      assignedColor = this.playerColors[playerIndex % this.playerColors.length];
      console.log(`All ${this.playerColors.length} colors are in use! Cycling back to color: ${assignedColor}`);
    }
    
    console.log(`Used colors: [${Array.from(usedColors).join(', ')}]`);
    console.log(`Assigning player color: ${assignedColor} (unique: ${!usedColors.has(assignedColor)})`);
    
    return assignedColor;
  }

  private spawnCenterGun() {
    // Find the ground platform for the current map
    const mapConfig = getMapConfig(this.currentMap);
    const groundPlatform = mapConfig.platforms.find(platform => platform.type === 'ground');
    
    if (!groundPlatform) {
      console.error('No ground platform found in map config!');
      return;
    }

    // Spawn a gun in the center of the ground
    const gun = new GunState();
    gun.id = "center_gun";
    gun.x = mapConfig.width / 2; // Center of map width
    gun.y = groundPlatform.y - 10; // Just above the ground platform
    gun.isPickedUp = false;

    this.state.guns.set("center_gun", gun);
    console.log(`Gun spawned in center at x=${gun.x}, y=${gun.y} on ${mapConfig.name} (ground at y=${groundPlatform.y})`);
  }

  private checkGunPickups() {
    this.state.guns.forEach((gun, gunId) => {
      if (gun.isPickedUp) return; // Skip already picked up guns

      this.state.players.forEach((player, playerId) => {
        if (player.hasGun) return; // Skip players who already have a gun

        // Check collision between player and gun (simple distance check)
        const distance = Math.sqrt(
          Math.pow(player.x - gun.x, 2) + Math.pow(player.y - gun.y, 2)
        );

        if (distance < 40) { // Close enough to pick up
          // Player picks up the gun
          gun.isPickedUp = true;
          player.hasGun = true;

          console.log(`Player ${playerId} picked up gun ${gunId}`);
        }
      });
    });
  }
}