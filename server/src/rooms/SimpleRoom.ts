import { Room, Client } from '@colyseus/core';
import { SimpleGameState } from './schema/SimpleGameState';
import { SimplePlayerState } from './schema/SimplePlayerState';
import { GunState } from './schema/GunState';
import { BulletState } from './schema/BulletState';
import { ArcadePhysics } from 'arcade-physics';
import { SimpleMapConfig, Platform, getMapConfig, MapName, Maps, getRandomMapName, GunSpawn } from '@nature-game/shared';

export class SimpleRoom extends Room<SimpleGameState> {
  maxClients = 4;

  private readonly MOVE_SPEED = 100; // pixels per second
  private readonly JUMP_SPEED = 400; // pixels per second
  private readonly PLAYER_WIDTH = 32;
  private readonly PLAYER_HEIGHT = 48;
  private readonly BULLET_SPEED = 400; // pixels per second
  private readonly BULLET_GRAVITY = 300; // pixels per second squared
  private readonly BULLET_INITIAL_ANGLE = -100; // Initial upward velocity (negative = up)

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
    
    // Spawn guns based on map configuration
    this.spawnGuns();

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

    // Handle J key action (pickup gun or shoot)
    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) {
        console.log(`Cannot perform action: player ${client.sessionId} is dead or doesn't exist`);
        return;
      }

      // If player doesn't have a gun, try to pick one up
      if (!player.hasGun) {
        const pickedUp = this.tryPickupGun(client.sessionId);
        if (pickedUp) {
          console.log(`Player ${client.sessionId} picked up a gun with J key`);
        } else {
          console.log(`Player ${client.sessionId} tried to pick up gun but none in range`);
        }
        return;
      }

      // If player has a gun, shoot
      const bulletId = `bullet_${client.sessionId}_${Date.now()}`;
      const bullet = new BulletState();
      bullet.id = bulletId;
      bullet.ownerId = client.sessionId;
      bullet.direction = player.facingDirection;
      bullet.x = player.x + (player.facingDirection === 'right' ? 32 : -8);
      bullet.y = player.y + 20;
      bullet.velocityX = player.facingDirection === 'right' ? this.BULLET_SPEED : -this.BULLET_SPEED;
      bullet.velocityY = this.BULLET_INITIAL_ANGLE; // Start with upward angle

      this.state.bullets.set(bulletId, bullet);
      console.log(`Player ${client.sessionId} shot bullet with gun`);
    });

    // Handle dropping gun
    this.onMessage("dropGun", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.hasGun || player.isDead) {
        console.log(`Cannot drop gun: player ${client.sessionId} - hasGun: ${player?.hasGun}, isDead: ${player?.isDead}`);
        return;
      }

      // Player drops the gun
      player.hasGun = false;
      
      // Create a new gun entity at player's position
      const droppedGunId = `dropped_gun_${client.sessionId}_${Date.now()}`;
      const droppedGun = new GunState();
      droppedGun.id = droppedGunId;
      droppedGun.x = player.x + 16; // Center of player
      droppedGun.y = player.y + 35; // Slightly below player (closer for easier pickup)
      droppedGun.isPickedUp = false;

      this.state.guns.set(droppedGunId, droppedGun);
      console.log(`Player ${client.sessionId} dropped gun '${droppedGunId}' at x=${droppedGun.x}, y=${droppedGun.y} (pickupable: ${!droppedGun.isPickedUp})`);
    });

    // Handle ping requests for latency measurement
    this.onMessage("ping", (client, data) => {
      // Simply respond with pong - the client will calculate the round-trip time
      client.send("pong", data);
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
    player.isDead = false; // Alive by default
    
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

        // Skip movement if player is dead
        if (player.isDead) return;

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

    // Note: Gun pickups are now manual (J key), not automatic

    // Update bullets
    this.updateBullets();
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

  private spawnGuns() {
    const mapConfig = getMapConfig(this.currentMap);
    
    // Spawn guns based on map configuration
    mapConfig.gunSpawns.forEach((gunSpawn: GunSpawn) => {
      const gun = new GunState();
      gun.id = gunSpawn.id;
      gun.x = gunSpawn.x;
      gun.y = gunSpawn.y;
      gun.isPickedUp = false;

      this.state.guns.set(gunSpawn.id, gun);
      console.log(`Gun '${gunSpawn.id}' spawned at x=${gun.x}, y=${gun.y} on ${mapConfig.name}`);
    });
    
    console.log(`Total ${mapConfig.gunSpawns.length} guns spawned on ${mapConfig.name}`);
  }

  private tryPickupGun(playerId: string): boolean {
    const player = this.state.players.get(playerId);
    if (!player || player.hasGun || player.isDead) {
      return false; // Can't pick up if player has gun, is dead, or doesn't exist
    }

    // Find the closest available gun
    let closestGun: { gun: any, gunId: string, distance: number } | null = null;

    this.state.guns.forEach((gun, gunId) => {
      if (gun.isPickedUp) return; // Skip already picked up guns

      // Check distance to this gun
      // Player position is top-left, so calculate center of player
      const playerCenterX = player.x + this.PLAYER_WIDTH / 2;  // player.x + 16
      const playerCenterY = player.y + this.PLAYER_HEIGHT / 2; // player.y + 24
      
      // Gun position is already center, so compare center-to-center
      const distance = Math.sqrt(
        Math.pow(playerCenterX - gun.x, 2) + Math.pow(playerCenterY - gun.y, 2)
      );

      if (distance < 40) { // Within pickup range
        if (!closestGun || distance < closestGun.distance) {
          closestGun = { gun, gunId, distance };
        }
      }
    });

    // Pick up the closest gun if found
    if (closestGun) {
      closestGun.gun.isPickedUp = true;
      player.hasGun = true;
      console.log(`Player ${playerId} picked up gun '${closestGun.gunId}' (distance: ${Math.round(closestGun.distance)})`);
      return true;
    }

    return false; // No gun found in range
  }

  private updateBullets() {
    const bulletsToRemove: string[] = [];
    const deltaTime = 16.666 / 1000; // Convert frame time to seconds

    this.state.bullets.forEach((bullet, bulletId) => {
      // Apply gravity to vertical velocity
      bullet.velocityY += this.BULLET_GRAVITY * deltaTime;
      
      // Update bullet position with both horizontal and vertical movement
      bullet.x += bullet.velocityX * deltaTime;
      bullet.y += bullet.velocityY * deltaTime;

      // Remove bullets that are off-screen or hit the ground
      if (bullet.x < -50 || bullet.x > 850 || bullet.y > 650) {
        bulletsToRemove.push(bulletId);
        return;
      }

      // Check collision with players (simple AABB collision)
      this.state.players.forEach((player, playerId) => {
        if (playerId === bullet.ownerId || player.isDead) return; // Skip bullet owner and dead players

        // Simple collision detection
        if (bullet.x >= player.x && bullet.x <= player.x + 32 && 
            bullet.y >= player.y && bullet.y <= player.y + 48) {
          // Player is hit - they die
          player.isDead = true;
          if (player.hasGun) {
            // Drop gun when dead
            player.hasGun = false;
            
            // Create dropped gun at player's position
            const deathDropGunId = `death_drop_${playerId}_${Date.now()}`;
            const deathDropGun = new GunState();
            deathDropGun.id = deathDropGunId;
            deathDropGun.x = player.x + 16;
            deathDropGun.y = player.y + 35;
            deathDropGun.isPickedUp = false;
            
            this.state.guns.set(deathDropGunId, deathDropGun);
            console.log(`Player ${playerId} died and dropped gun '${deathDropGunId}' at x=${deathDropGun.x}, y=${deathDropGun.y}`);
          }
          console.log(`Player ${playerId} was killed by ${bullet.ownerId}'s bullet!`);
          bulletsToRemove.push(bulletId);
        }
      });
    });

    // Remove bullets
    bulletsToRemove.forEach(bulletId => {
      this.state.bullets.delete(bulletId);
    });
  }
}