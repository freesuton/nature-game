import * as Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { SimpleMapConfig, Platform, MapName, getRandomMapName } from '@nature-game/shared';
import { SimplePlayerConfig } from '../sprites/SimplePlayerConfig';

interface SimplePlayer {
  x: number;
  y: number;
  movingLeft: boolean;
  movingRight: boolean;
  color: string;
  facingDirection: string;
  hasWeapon: boolean;
  weaponType: string;
  isDead: boolean;
}



interface SimpleBullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  direction: string;
}

export class SimpleScene extends Phaser.Scene {
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;
  private players: Map<string, SimplePlayerConfig> = new Map();
  private playerCoordTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private weapons: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private weaponLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private bullets: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private meleeAttacks: Map<string, Phaser.GameObjects.Arc> = new Map();
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
  private jKey!: Phaser.Input.Keyboard.Key;
  private kKey!: Phaser.Input.Keyboard.Key;
  private currentMap: MapName = 'simple'; // Default map
  private mapInitialized = false;
  private mapNameText?: Phaser.GameObjects.Text;
  private playerCountText?: Phaser.GameObjects.Text;
  private lagText?: Phaser.GameObjects.Text;
  private centerCoordsText?: Phaser.GameObjects.Text;
  private platformVisuals: Phaser.GameObjects.Rectangle[] = [];
  
  // Ping/Lag tracking
  private lastPingTime: number = 0;
  private pingHistory: number[] = [];
  private pingInterval?: number;

  constructor() {
    super({ 
      key: 'SimpleScene',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: SimpleMapConfig.gravity,
          debug: true,
          width: SimpleMapConfig.width,
          height: SimpleMapConfig.height
        }
      }
    });
  }

  preload() {
    // Load the dude sprite from Phaser labs
    this.load.spritesheet('dude', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
  }

  create() {
    console.log('SimpleScene created');

    // Handle map selection from scene data
    const sceneData = this.scene.settings.data as any;
    if (sceneData?.mapName === 'random') {
      this.currentMap = getRandomMapName();
      console.log(`Client selected random map: ${this.currentMap}`);
    } else if (sceneData?.mapName) {
      this.currentMap = sceneData.mapName as MapName;
    }
    
    // Don't create map immediately - wait for server confirmation
    // This ensures client and server use the same map
    console.log(`Client requesting map: ${this.currentMap}`);
    

    // Add vertical ruler marks every 100 pixels
    for (let y = 0; y <= 600; y += 100) {
      this.add.line(0, y, 0, 0, 20, 0, 0x000000, 1).setLineWidth(2); // Ruler mark
      this.add.text(25, y - 10, `${y}px`, { fontSize: '12px', color: '#000000' }); // Height label
    }

    // Add horizontal ruler marks every 100 pixels
    for (let x = 0; x <= 800; x += 100) {
      this.add.line(x, 0, 0, 0, 0, 20, 0x000000, 1).setLineWidth(2); // Ruler mark
      this.add.text(x - 15, 25, `${x}px`, { fontSize: '12px', color: '#000000' }); // Width label
    }

    // Add map name display at top center (will be updated when map loads)
    this.mapNameText = this.add.text(400, 50, 'Loading Map...', {
      fontSize: '24px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5, 0.5); // Center the text

    // Add player count display
    this.playerCountText = this.add.text(16, 16, 'Players: 0', {
      fontSize: '16px',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setScrollFactor(0).setDepth(1000);

    // Add interaction instructions
    // this.add.text(400, 540, 'Press J to Pickup/Shoot | K to Drop Weapon (One weapon at a time)', {
    //   fontSize: '16px',
    //   color: '#FFFF00',
    //   backgroundColor: '#000000',
    //   padding: { x: 8, y: 4 }
    // }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1000);

    // Add quit button
    this.add.text(400, 580, 'Press M for Menu', {
      fontSize: '16px',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1000);

    // Lag/Ping indicator in top-right corner
    this.lagText = this.add.text(784, 16, 'Ping: --ms', {
      fontSize: '14px',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    // Player coordinates display in center
    this.centerCoordsText = this.add.text(400, 300, 'Player: (---, ---)', {
      fontSize: '16px',
      color: '#FFFF00',
      backgroundColor: '#000000',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1000);
    

    // Setup WASD input
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D') as any;

    // Setup J key for using weapon
    this.jKey = this.input.keyboard!.addKey('J');

    // Setup K key for dropping weapon
    this.kKey = this.input.keyboard!.addKey('K');

    // Menu key
    this.input.keyboard!.on('keydown-M', () => {
      this.leaveRoom();
      this.scene.start('MenuScene');
    });

    // Connect to server
    this.connectToServer();
  }

  private async connectToServer() {
    try {
      // Dynamic server URL - works for both local development and deployment
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:2567';
      const serverUrl = `${protocol}//${host}`;
      
      console.log(`Connecting to server: ${serverUrl}`);
      this.client = new Colyseus.Client(serverUrl);
      
      // Join an existing room if possible, otherwise create a new one
      this.room = await this.client.joinOrCreate('simple', {
        mapName: 'random'
      });

      console.log('Connected to SimpleRoom:', this.room.id);

      // Start ping monitoring
      this.startPingMonitoring();

      // Handle map info from server (this is the authoritative map)
      this.room.onMessage('mapInfo', (data) => {
        console.log('Received map info from server:', data);
        this.currentMap = data.mapName;
        this.createMapFromServerInfo(data.mapConfig);
        
        // Update map name display with map-specific styling
        if (this.mapNameText) {
          const mapDisplayName = this.getMapDisplayName(data.mapName);
          const mapColor = this.getMapNameColor(data.mapName);
          this.mapNameText.setText(mapDisplayName);
          this.mapNameText.setColor(mapColor);
        }
      });

      // When a player is added
      this.room.state.players.onAdd((player: SimplePlayer, sessionId: string) => {
        console.log('Player added:', sessionId, 'at', player.x, player.y, 'color:', player.color);
        
        // Use server-provided color
        const colorHex = parseInt(player.color.replace('#', ''), 16);
        const isMyPlayer = sessionId === this.room?.sessionId;
        const playerIndex = this.players.size + 1;
        const playerName = isMyPlayer ? `You (P${playerIndex})` : `Player ${playerIndex}`;
        
        // Create SimplePlayerConfig instance with server-provided color and name
        const simplePlayer = new SimplePlayerConfig(this, player.x, player.y, colorHex, playerName);
        
        // Create coordinate display text above player
        const coordText = this.add.text(player.x + 16, player.y - 25, `(${Math.round(player.x)}, ${Math.round(player.y)})`, {
          fontSize: '10px',
          color: '#FFFF00',
          stroke: '#000000',
          strokeThickness: 1
        }).setOrigin(0.5, 1); // Center horizontally, bottom align
        
        this.players.set(sessionId, simplePlayer);
        this.playerCoordTexts.set(sessionId, coordText);
        
        // Initialize center coordinates display for current player
        if (isMyPlayer && this.centerCoordsText) {
          this.centerCoordsText.setText(`Player: (${Math.round(player.x)}, ${Math.round(player.y)})`);
        }
        
        this.updatePlayerCount();

        // Listen for changes to this specific player
        (player as any).onChange(() => {
          console.log(`Player ${sessionId} update: x=${player.x}, y=${player.y}, left=${player.movingLeft}, right=${player.movingRight}, facing=${player.facingDirection}, hasWeapon=${player.hasWeapon}, weaponType=${player.weaponType}, isDead=${player.isDead}`);
          
          // Get SimplePlayerConfig instance
          const simplePlayer = this.players.get(sessionId);
          const coordText = this.playerCoordTexts.get(sessionId);
          if (!simplePlayer) return;
          
          // Update position, movement, and facing direction
          simplePlayer.updatePosition(player.x, player.y);
          simplePlayer.updateMovement(player.movingLeft, player.movingRight);
          simplePlayer.updateFacingDirection(player.facingDirection);
          
          // Update coordinate text position and content
          if (coordText) {
            coordText.setPosition(player.x + 16, player.y - 25);
            coordText.setText(`(${Math.round(player.x)}, ${Math.round(player.y)})`);
          }
          
          // Update center coordinates display for current player
          if (isMyPlayer && this.centerCoordsText) {
            this.centerCoordsText.setText(`Player: (${Math.round(player.x)}, ${Math.round(player.y)})`);
          }
          
          // Update death state visual while preserving original color
          if (player.isDead) {
            simplePlayer.sprite.setTint(0x808080); // Gray tint for dead players
            simplePlayer.sprite.setAlpha(0.5); // Semi-transparent
          } else {
            simplePlayer.sprite.setTint(colorHex); // Restore original color
            simplePlayer.sprite.setAlpha(1.0);
          }
          
          // Update name text to show weapon and death status
          const baseName = isMyPlayer ? `You (P${playerIndex})` : `Player ${playerIndex}`;
          const weaponStatus = player.hasWeapon ? ` [${player.weaponType.toUpperCase()}]` : '';
          const deathStatus = player.isDead ? ' [DEAD]' : '';
          simplePlayer.nameText.setText(baseName + weaponStatus + deathStatus);
          
          if (player.isDead) {
            simplePlayer.nameText.setColor('#FF0000'); // Red if dead
          } else if (player.hasWeapon) {
            simplePlayer.nameText.setColor('#4169E1'); // Blue if has weapon
          } else {
            simplePlayer.nameText.setColor('#FFFFFF'); // White if normal
          }
        });
      });

      // When a player is removed
      this.room.state.players.onRemove((_player: SimplePlayer, sessionId: string) => {
        console.log('Player removed:', sessionId);
        
        const simplePlayer = this.players.get(sessionId);
        if (simplePlayer) {
          simplePlayer.destroy();
          this.players.delete(sessionId);
        }
        
        // Destroy coordinate text
        const coordText = this.playerCoordTexts.get(sessionId);
        if (coordText) {
          coordText.destroy();
          this.playerCoordTexts.delete(sessionId);
        }
        
        this.updatePlayerCount();
      });



      // When a weapon is added
      this.room.state.weapons.onAdd((weapon: any, weaponId: string) => {
        console.log('Weapon added:', weaponId, 'at', weapon.x, weapon.y, 'type:', weapon.weaponType);
        
        // Create visual weapon using colors from server weapon state
        const weaponColor = weapon.weaponColor || 0xC0C0C0; // Use server color or default to silver
        const strokeColor = weapon.strokeColor || 0x4169E1; // Use server color or default to blue
        const weaponRect = this.add.rectangle(weapon.x, weapon.y, 24, 6, weaponColor)
        weaponRect.setStrokeStyle(2, strokeColor);
        this.weapons.set(weaponId, weaponRect);

        // Create weapon label above the weapon - show weapon name if available
        const labelText = weapon.weaponName ? weapon.weaponName.toUpperCase() : weapon.weaponType.toUpperCase();
        const labelColor = weapon.labelColor || '#4169E1'; // Use server color or default to blue
        const weaponLabel = this.add.text(weapon.x, weapon.y - 20, labelText, {
          fontSize: '12px',
          color: labelColor,
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 }
        });
        weaponLabel.setOrigin(0.5, 0.5);
        this.weaponLabels.set(weaponId, weaponLabel);

        // Listen for weapon changes (pickup/position)
        (weapon as any).onChange(() => {
          const weaponRect = this.weapons.get(weaponId);
          const weaponLabel = this.weaponLabels.get(weaponId);
          if (weaponRect && weaponLabel && weapon.isPickedUp) {
            // Hide weapon and label when picked up
            weaponRect.setVisible(false);
            weaponLabel.setVisible(false);
          } else if (weaponRect && weaponLabel && !weapon.isPickedUp) {
            // Show and update position when available
            weaponRect.setVisible(true);
            weaponLabel.setVisible(true);
            weaponRect.setPosition(weapon.x, weapon.y);
            weaponLabel.setPosition(weapon.x, weapon.y - 20);
          }
        });
      });

      // When a weapon is removed
      this.room.state.weapons.onRemove((_weapon: any, weaponId: string) => {
        console.log('Weapon removed:', weaponId);
        
        const weaponRect = this.weapons.get(weaponId);
        const weaponLabel = this.weaponLabels.get(weaponId);
        if (weaponRect) {
          weaponRect.destroy();
          this.weapons.delete(weaponId);
        }
        if (weaponLabel) {
          weaponLabel.destroy();
          this.weaponLabels.delete(weaponId);
        }
      });

      // When a bullet is added
      this.room.state.bullets.onAdd((bullet: SimpleBullet, bulletId: string) => {
        console.log('Bullet added:', bulletId, 'at', bullet.x, bullet.y);
        
        // Create visual bullet (yellow rectangle)
        const bulletRect = this.add.rectangle(bullet.x, bullet.y, 8, 4, 0xFFFF00);
        bulletRect.setOrigin(0, 0.5);
        this.bullets.set(bulletId, bulletRect);

        // Listen for bullet position changes
        (bullet as any).onChange(() => {
          const bulletRect = this.bullets.get(bulletId);
          if (bulletRect) {
            bulletRect.setPosition(bullet.x, bullet.y);
          }
        });
      });

      // When a bullet is removed
      this.room.state.bullets.onRemove((_bullet: SimpleBullet, bulletId: string) => {
        console.log('Bullet removed:', bulletId);
        
        const bulletRect = this.bullets.get(bulletId);
        if (bulletRect) {
          bulletRect.destroy();
          this.bullets.delete(bulletId);
        }
      });

      // Handle connection errors
      this.room.onError((code: number, message?: string) => {
        console.error('Room error:', code, message);
      });

      this.room.onLeave((code: number) => {
        console.log('Left room with code:', code);
      });

      // Handle ping response from server
      this.room.onMessage('pong', () => {
        const currentTime = Date.now();
        const pingTime = currentTime - this.lastPingTime;
        this.updatePing(pingTime);
      });

      // Handle melee attack visualization
      this.room.onMessage('meleeAttack', (data: any) => {
        this.showMeleeAttack(data);
      });

    } catch (error) {
      console.error('Failed to connect to server:', error);
    }
  }

  update() {
    if (!this.room) return;

    // Send input to server (WASD only)
    const leftPressed = this.wasdKeys.A.isDown;
    const rightPressed = this.wasdKeys.D.isDown;

    const jumpPressed = this.wasdKeys.W.isDown;

    // Always send input state
    this.room.send('move', {
      left: leftPressed,
      right: rightPressed,
      jump: jumpPressed
    });

    // Handle weapon use input (J key)
    if (Phaser.Input.Keyboard.JustDown(this.jKey)) {
      this.room.send('useWeapon', {});
    }

    // Handle drop weapon input (K key)
    if (Phaser.Input.Keyboard.JustDown(this.kKey)) {
      this.room.send('dropWeapon', {});
    }
  }

  private leaveRoom() {
    if (this.room) {
      this.room.leave();
    }
  }

  shutdown() {
    this.leaveRoom();
    
    // Stop ping monitoring
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    
    // Reset map initialization flag and clear visuals so platforms will be rebuilt when rejoining
    this.mapInitialized = false;
    this.platformVisuals.forEach(visual => visual.destroy());
    this.platformVisuals = [];
    
    // Clean up weapons, labels, bullets, and sword swings
    this.weapons.forEach(weapon => weapon.destroy());
    this.weapons.clear();
    this.weaponLabels.forEach(label => label.destroy());
    this.weaponLabels.clear();
    this.bullets.forEach(bullet => bullet.destroy());
    this.bullets.clear();
    this.meleeAttacks.forEach(attack => attack.destroy());
    this.meleeAttacks.clear();
    
    // Clean up coordinate texts
    this.playerCoordTexts.forEach(coordText => coordText.destroy());
    this.playerCoordTexts.clear();
  }

  private createMapFromServerInfo(mapConfig: any) {
    console.log(`Creating map from server: ${mapConfig.name}`, 'mapInitialized:', this.mapInitialized);
    
    // Clear existing platform visuals
    this.platformVisuals.forEach(visual => visual.destroy());
    this.platformVisuals = [];
    
    // Create platforms from server-provided map config
    const platforms: Phaser.Physics.Arcade.StaticBody[] = [];
    
    mapConfig.platforms.forEach((platformConfig: Platform) => {
      const platform = this.physics.add.staticBody(
        platformConfig.x, 
        platformConfig.y, 
        platformConfig.width, 
        platformConfig.height
      );
      platforms.push(platform);
      
      // Add visual representation for each platform with map-specific colors
      const color = this.getMapPlatformColor(this.currentMap, platformConfig.type);
      const visual = this.add.rectangle(
        platformConfig.x, 
        platformConfig.y, 
        platformConfig.width, 
        platformConfig.height, 
        color
      ).setOrigin(0, 0);
      
      this.platformVisuals.push(visual);
    });

    this.mapInitialized = true;
    console.log(`Map '${mapConfig.name}' created successfully! Platforms: ${this.platformVisuals.length}`);
  }

  private getMapPlatformColor(mapName: MapName, platformType: 'ground' | 'platform'): number {
    const mapColors = {
      simple: {
        ground: 0x8B4513,     // Brown
        platform: 0x654321   // Dark brown
      },
      forest: {
        ground: 0x228B22,     // Forest green
        platform: 0x8B4513   // Brown wood
      },
      cave: {
        ground: 0x696969,     // Dark gray
        platform: 0x2F4F4F   // Dark slate gray
      }
    };

    return mapColors[mapName][platformType];
  }

  private getMapDisplayName(mapName: MapName): string {
    const displayNames = {
      simple: '🏠 Simple Map',
      forest: '🌲 Forest Map', 
      cave: '🏔️ Cave Map'
    };
    return displayNames[mapName] || mapName;
  }

  private getMapNameColor(mapName: MapName): string {
    const nameColors = {
      simple: '#8B4513',    // Brown
      forest: '#228B22',    // Forest green
      cave: '#696969'       // Gray
    };
    return nameColors[mapName] || '#FFFFFF';
  }

  private updatePlayerCount() {
    if (this.playerCountText && this.room) {
      const playerCount = Object.keys(this.room.state.players).length;
      this.playerCountText.setText(`Players: ${playerCount}`);
    }
  }



  private startPingMonitoring() {
    // Send initial ping
    this.sendPing();
    
    // Set up regular ping interval (every 2 seconds)
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 2000);
  }

  private sendPing() {
    if (!this.room) return;
    
    this.lastPingTime = Date.now();
    this.room.send('ping', { timestamp: this.lastPingTime });
  }

  private updatePing(pingTime: number) {
    // Keep a rolling average of the last 5 pings
    this.pingHistory.push(pingTime);
    if (this.pingHistory.length > 5) {
      this.pingHistory.shift();
    }
    
    // Calculate average ping
    const avgPing = Math.round(this.pingHistory.reduce((a, b) => a + b, 0) / this.pingHistory.length);
    
    // Update display
    this.updateLagDisplay(avgPing);
  }

  private updateLagDisplay(ping: number) {
    if (!this.lagText) return;

    // Color code based on ping quality
    let color = '#00FF00'; // Green for good ping
    
    if (ping > 200) {
      color = '#FF0000'; // Red for bad ping
    } else if (ping > 100) {
      color = '#FFA500'; // Orange for moderate ping
    } else if (ping > 50) {
      color = '#FFFF00'; // Yellow for okay ping
    }

    this.lagText.setText(`${ping}ms`);
    this.lagText.setColor(color);
  }

  private showMeleeAttack(data: any) {
    console.log('Melee attack visualization:', data);
    
    // Create semicircle arc for attack visualization
    const attackArc = this.add.arc(data.x, data.y, data.range, 0, 0, false, 0xFFFF00); // Yellow semicircle
    attackArc.setStrokeStyle(3, 0xFFFF00);
    attackArc.setAlpha(0.7);
    
    // Set the arc to show a semicircle based on direction
    if (data.direction === 'right') {
      // Right facing: -90° to +90° semicircle
      attackArc.setStartAngle(-90);
      attackArc.setEndAngle(90);
    } else {
      // Left facing: 90° to 270° semicircle  
      attackArc.setStartAngle(90);
      attackArc.setEndAngle(270);
    }
    
    this.meleeAttacks.set(data.id, attackArc);
    
    // Add attack animation (scale up and fade out)
    this.tweens.add({
      targets: attackArc,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        attackArc.destroy();
        this.meleeAttacks.delete(data.id);
      }
    });
  }
}