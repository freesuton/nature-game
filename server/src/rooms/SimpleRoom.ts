import { Room, Client } from '@colyseus/core';
import { SimpleGameState } from './schema/SimpleGameState';
import { SimplePlayerState } from './schema/SimplePlayerState';
import { WeaponState } from './schema/WeaponState';
import { BulletState } from './schema/BulletState';
import { ArcadePhysics } from 'arcade-physics';
import { SimpleMapConfig, Platform, getMapConfig, MapName, Maps, getRandomMapName, WeaponSpawn } from '@nature-game/shared';

export class SimpleRoom extends Room<SimpleGameState> {
  maxClients = 4;

  private readonly MOVE_SPEED = 150; // pixels per second
  private readonly JUMP_SPEED = 400; // pixels per second
  private readonly PLAYER_WIDTH = 32;
  private readonly PLAYER_HEIGHT = 48;

  // Arcade Physics objects
  private physics!: ArcadePhysics;
  private platforms: any[] = [];
  private playerBodies: Map<string, any> = new Map();
  private weaponBodies: Map<string, any> = new Map();
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
    
    // Spawn weapons based on map configuration
    this.spawnWeapons();

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

    // Handle J key action (pickup weapon)
    this.onMessage("useWeapon", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) {
        console.log(`Cannot perform action: player ${client.sessionId} is dead or doesn't exist`);
        return;
      }

      // If player doesn't have any weapon, try to pick one up
      if (!player.hasWeapon) {
        const weaponPickedUp = this.tryPickupWeapon(client.sessionId);
        if (weaponPickedUp) {
          console.log(`Player ${client.sessionId} picked up a weapon with J key`);
          return;
        }
        
        console.log(`Player ${client.sessionId} tried to pick up weapon but none in range`);
        return;
      }

      // Check if player's weapon is long range
      const weaponType = player.weaponType;
      const weaponTemplate = new WeaponState(weaponType);
      
      if (weaponTemplate.bulletState) {
        // Long range weapon - create and shoot bullet
        this.createBullet(client.sessionId);
        console.log(`Player ${client.sessionId} fired ${weaponTemplate.weaponName}`);
      } else {
        // Melee weapon - perform swing attack
        this.performMeleeAttack(client.sessionId, weaponTemplate);
        console.log(`Player ${client.sessionId} swung ${weaponTemplate.weaponName} with range ${weaponTemplate.attackRange}`);
      }
    });

    // Handle dropping weapon
    this.onMessage("dropWeapon", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.hasWeapon || player.isDead) {
        console.log(`Cannot drop weapon: player ${client.sessionId} - hasWeapon: ${player?.hasWeapon}, isDead: ${player?.isDead}`);
        return;
      }

      this.dropPlayerWeapon(client.sessionId);
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

    // Update weapon physics (for dropped weapons with physics bodies)
    this.updateWeaponPhysics();

    // Update bullet physics (move bullets)
    this.updateBulletPhysics();

    // Note: Weapon pickups are now manual (J key), not automatic
  }

  private createBullet(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || !player.hasWeapon) {
      return;
    }

    // Create weapon template to check if it has bulletState
    const weaponTemplate = new WeaponState(player.weaponType);
    
    if (!weaponTemplate.bulletState) {
      return; // This weapon doesn't shoot bullets
    }

    // Create bullet
    const bulletId = `bullet_${playerId}_${Date.now()}`;
    const bullet = new BulletState();
    bullet.id = bulletId;
    bullet.ownerId = playerId;
    
    // Position bullet at player location
    bullet.x = player.x + (this.PLAYER_WIDTH / 2); // Center of player
    bullet.y = player.y + (this.PLAYER_HEIGHT / 2);
    
    // Set bullet velocity based on player facing direction
    const bulletSpeed = 400; // Bullet speed
    if (player.facingDirection === "left") {
      bullet.velocityX = -bulletSpeed;
      bullet.direction = "left";
    } else {
      bullet.velocityX = bulletSpeed;
      bullet.direction = "right";
    }
    bullet.velocityY = 0; // Straight horizontal shot
    
    // Add bullet to game state
    this.state.bullets.set(bulletId, bullet);
    
    console.log(`Bullet '${bulletId}' created for player ${playerId} going ${bullet.direction}`);
    
    // Remove bullet after 3 seconds
    this.clock.setTimeout(() => {
      this.state.bullets.delete(bulletId);
      console.log(`Bullet '${bulletId}' expired`);
    }, 3000);
  }

  private performMeleeAttack(playerId: string, weaponTemplate: WeaponState) {
    const player = this.state.players.get(playerId);
    if (!player || !player.hasWeapon) {
      return;
    }

    // Create a melee attack area with semicircle
    const attackId = `melee_${playerId}_${Date.now()}`;
    const playerCenterX = player.x + (this.PLAYER_WIDTH / 2);
    const playerCenterY = player.y + (this.PLAYER_HEIGHT / 2);
    
    // Create attack data for client visualization
    const attackData = {
      id: attackId,
      playerId: playerId,
      x: playerCenterX,
      y: playerCenterY,
      range: weaponTemplate.attackRange,
      direction: player.facingDirection,
      weaponName: weaponTemplate.weaponName
    };
    
    // Send melee attack effect to all clients for visualization
    this.broadcast('meleeAttack', attackData);
    
    // Check for targets within the swing area (semicircle)
    this.state.players.forEach((targetPlayer, targetId) => {
      if (targetId === playerId || targetPlayer.isDead) return; // Skip self and dead players
      
      const targetCenterX = targetPlayer.x + (this.PLAYER_WIDTH / 2);
      const targetCenterY = targetPlayer.y + (this.PLAYER_HEIGHT / 2);
      
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(targetCenterX - playerCenterX, 2) + 
        Math.pow(targetCenterY - playerCenterY, 2)
      );
      
      // Check if target is within range
      if (distance <= weaponTemplate.attackRange) {
        // Calculate angle to target
        const angleToTarget = Math.atan2(targetCenterY - playerCenterY, targetCenterX - playerCenterX);
        
        // Check if target is in the semicircle facing direction
        let inAttackArea = false;
        if (player.facingDirection === 'right') {
          // Right facing: -90° to +90° (right semicircle)
          inAttackArea = angleToTarget >= -Math.PI/2 && angleToTarget <= Math.PI/2;
        } else {
          // Left facing: 90° to 270° (left semicircle)
          inAttackArea = angleToTarget >= Math.PI/2 || angleToTarget <= -Math.PI/2;
        }
        
        if (inAttackArea) {
          console.log(`Player ${playerId} hit player ${targetId} with melee attack!`);
          // Here you could add damage logic later
        }
      }
    });
    
    console.log(`Melee attack by player ${playerId} at (${playerCenterX}, ${playerCenterY}) facing ${player.facingDirection} with range ${weaponTemplate.attackRange}`);
  }

  private updateBulletPhysics() {
    this.state.bullets.forEach((bullet, bulletId) => {
      // Move bullet based on velocity
      bullet.x += bullet.velocityX * (16.666 / 1000); // Move based on frame time
      bullet.y += bullet.velocityY * (16.666 / 1000);
      
      // Remove bullet if it goes off screen
      if (bullet.x < -50 || bullet.x > 850 || bullet.y < -50 || bullet.y > 650) {
        this.state.bullets.delete(bulletId);
        console.log(`Bullet '${bulletId}' went off screen and was removed`);
      }
    });
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



  private spawnWeapons() {
    const mapConfig = getMapConfig(this.currentMap);
    
    // Spawn weapons based on map configuration
    mapConfig.weaponSpawns.forEach((weaponSpawn: WeaponSpawn) => {
      const weapon = new WeaponState(weaponSpawn.type);
      weapon.id = weaponSpawn.id;
      weapon.x = weaponSpawn.x;
      weapon.y = weaponSpawn.y;
      weapon.isPickedUp = false;

      this.state.weapons.set(weaponSpawn.id, weapon);
      
      // Create physics body for spawned weapons with gravity disabled initially
      this.createWeaponPhysicsBody(weapon.id, weapon, weapon.weaponType);
      
      console.log(`${weapon.weaponName} '${weaponSpawn.id}' (${weapon.weaponType}) spawned at x=${weapon.x}, y=${weapon.y} with range=${weapon.attackRange} on ${mapConfig.name}`);
    });
    
    console.log(`Total ${mapConfig.weaponSpawns.length} weapons spawned on ${mapConfig.name}`);
  }



  private tryPickupWeapon(playerId: string): boolean {
    const player = this.state.players.get(playerId);
    if (!player || player.hasWeapon || player.isDead) {
      return false; // Can't pick up if player has weapon, is dead, or doesn't exist
    }

    // Find the closest available weapon
    let closestWeapon: { weapon: any, weaponId: string, distance: number, type: string } | null = null;

    // Player position is top-left, so calculate center of player
    const playerCenterX = player.x + this.PLAYER_WIDTH / 2;  // player.x + 16
    const playerCenterY = player.y + this.PLAYER_HEIGHT / 2; // player.y + 24

    // Check weapons
    this.state.weapons.forEach((weapon, weaponId) => {
      if (weapon.isPickedUp) return; // Skip already picked up weapons

      // Check distance to this weapon
      const distance = Math.sqrt(
        Math.pow(playerCenterX - weapon.x, 2) + Math.pow(playerCenterY - weapon.y, 2)
      );

      if (distance < 40) { // Within pickup range
        if (!closestWeapon || distance < closestWeapon.distance) {
          closestWeapon = { weapon: weapon, weaponId: weaponId, distance, type: weapon.weaponType };
        }
      }
    });

    // Pick up the closest weapon if found
    if (closestWeapon) {
      closestWeapon.weapon.isPickedUp = true;
      
      // Set player weapon status
      player.hasWeapon = true;
      player.weaponType = closestWeapon.type;
      
      // Remove the weapon's physics body since it's now picked up
      const weaponBody = this.weaponBodies.get(closestWeapon.weaponId);
      if (weaponBody) {
        this.physics.world.remove(weaponBody);
        this.weaponBodies.delete(closestWeapon.weaponId);
      }
      
      console.log(`Player ${playerId} picked up ${closestWeapon.type} '${closestWeapon.weaponId}' (distance: ${Math.round(closestWeapon.distance)})`);
      return true;
    }

    return false; // No weapon found in range
  }

  private createWeaponPhysicsBody(weaponId: string, weapon: WeaponState, weaponType: string) {
    // Create physics body for weapon with gravity disabled initially (spawned weapons stay in place)
    const weaponBody = this.physics.add.body(
      weapon.x - 12, // left edge (weapon is 24px wide)
      weapon.y - 3,  // top edge (weapon is 6px tall)
      24,            // width
      6              // height
    );
    
    weaponBody.setAllowGravity(false); // Spawned weapons don't fall initially
    weaponBody.bounce.set(0.3, 0.3); // Add some bounce for when they do fall
    this.weaponBodies.set(weaponId, weaponBody);
  }

  private updateWeaponPhysics() {
    this.weaponBodies.forEach((weaponBody, weaponId) => {
      // Find the weapon in weapons collection
      let weapon = this.state.weapons.get(weaponId);
      if (!weapon || weapon.isPickedUp) return;

      // Add collision between weapon and all platforms (so they don't fall through ground)
      this.platforms.forEach(platform => {
        this.physics.world.collide(weaponBody, platform);
      });

      // Apply realistic physics - minimal air resistance, strong ground friction
      const currentVelX = weaponBody.velocity.x;
      const currentVelY = weaponBody.velocity.y;
      
      // Check if weapon is on ground or in air
      if (weaponBody.touching.down || weaponBody.blocked.down) {
        // On ground: Strong friction to slow down sliding
        const groundFriction = 0.85; // Strong ground friction - loses 15% velocity per frame
        weaponBody.setVelocityX(currentVelX * groundFriction);
      } else {
        // In air: Minimal air resistance (realistic physics)
        const airResistance = 0.99; // Only loses 1% velocity per frame in air
        weaponBody.setVelocityX(currentVelX * airResistance);
      }

      // Update weapon position from physics body (center point)
      // For weapons
      weapon.x = weaponBody.x + 12; // weaponBody.x is left edge, weapon.x is center
      weapon.y = weaponBody.y + 3;  // weaponBody.y is top edge, weapon.y is center
    });
  }

  private dropPlayerWeapon(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || !player.hasWeapon || player.isDead) {
      return;
    }

    // Get player's current velocity and add throwing force
    const playerBody = this.playerBodies.get(playerId);
    let playerVelX = 0;
    let playerVelY = 0;
    if (playerBody) {
      playerVelX = playerBody.velocity.x;
      playerVelY = playerBody.velocity.y;
      
      // Add throwing force if player is moving
      if (Math.abs(playerVelX) > 10) { // If player is walking/running
        playerVelX *= 1.8; // Amplify horizontal momentum for throwing effect
        playerVelY -= 50; // Add slight upward force for realistic throw arc
      }
      
      // Add minimum throwing force based on facing direction
      const baseThrowForce = player.facingDirection === 'right' ? 80 : -80;
      playerVelX += baseThrowForce;
    }

    if (player.hasWeapon) {
      // Get the weapon type before dropping
      const weaponType = player.weaponType;
      
      // Player drops the weapon
      player.hasWeapon = false;
      player.weaponType = "";
      
      // Create a new weapon entity at player's position
      const droppedWeaponId = `dropped_${weaponType}_${playerId}_${Date.now()}`;
      const droppedWeapon = new WeaponState(weaponType);
      droppedWeapon.id = droppedWeaponId;
      droppedWeapon.x = player.x + 16; // Center of player
      droppedWeapon.y = player.y + 35; // Slightly below player
      droppedWeapon.isPickedUp = false;

      this.state.weapons.set(droppedWeaponId, droppedWeapon);
      
      // Create physics body for dropped weapon - will be dynamic for falling
      const weaponBody = this.physics.add.body(
        droppedWeapon.x - 12, // left edge (weapon is 24px wide)
        droppedWeapon.y - 3,  // top edge (weapon is 6px tall)
        24,                   // width
        6                     // height
      );
      weaponBody.setAllowGravity(true); // Enable gravity for falling
      weaponBody.bounce.set(0.3, 0.3); // Add some bounce
      
      // Transfer player's momentum to the weapon
      weaponBody.setVelocity(playerVelX, playerVelY);
      
      this.weaponBodies.set(droppedWeaponId, weaponBody);
      
      console.log(`Player ${playerId} dropped ${weaponType} '${droppedWeaponId}' at x=${droppedWeapon.x}, y=${droppedWeapon.y} with velocity (${Math.round(playerVelX)}, ${Math.round(playerVelY)}) (pickupable: ${!droppedWeapon.isPickedUp})`);
    }
  }
}