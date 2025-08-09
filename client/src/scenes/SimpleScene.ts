import * as Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { SimpleMapConfig, Platform, MapName, getRandomMapName } from '../../../MapConfig';
import { SimplePlayerConfig } from '../sprites/SimplePlayerConfig';

interface SimplePlayer {
  x: number;
  y: number;
  movingLeft: boolean;
  movingRight: boolean;
  color: string;
  facingDirection: string;
}

export class SimpleScene extends Phaser.Scene {
  private client!: Colyseus.Client;
  private room!: Colyseus.Room;
  private players: Map<string, SimplePlayerConfig> = new Map();
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
  private currentMap: MapName = 'simple'; // Default map
  private mapInitialized = false;
  private mapNameText?: Phaser.GameObjects.Text;
  private playerCountText?: Phaser.GameObjects.Text;
  private platformVisuals: Phaser.GameObjects.Rectangle[] = [];

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

    // Add quit button
    this.add.text(400, 580, 'Press M for Menu', {
      fontSize: '16px',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1000);
    

    // Setup WASD input
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D') as any;

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
      this.client = new Colyseus.Client('ws://localhost:2567');
      
      // Join an existing room if possible, otherwise create a new one
      this.room = await this.client.joinOrCreate('simple', {
        mapName: 'random'
      });

      console.log('Connected to SimpleRoom:', this.room.id);

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
        
        this.players.set(sessionId, simplePlayer);
        this.updatePlayerCount();

        // Listen for changes to this specific player
        (player as any).onChange(() => {
          console.log(`Player ${sessionId} update: x=${player.x}, y=${player.y}, left=${player.movingLeft}, right=${player.movingRight}, facing=${player.facingDirection}`);
          
          // Get SimplePlayerConfig instance
          const simplePlayer = this.players.get(sessionId);
          if (!simplePlayer) return;
          
          // Update position, movement, and facing direction
          simplePlayer.updatePosition(player.x, player.y);
          simplePlayer.updateMovement(player.movingLeft, player.movingRight);
          simplePlayer.updateFacingDirection(player.facingDirection);
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
        this.updatePlayerCount();
      });

      // Handle connection errors
      this.room.onError((code: number, message?: string) => {
        console.error('Room error:', code, message);
      });

      this.room.onLeave((code: number) => {
        console.log('Left room with code:', code);
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
  }

  private leaveRoom() {
    if (this.room) {
      this.room.leave();
    }
  }

  shutdown() {
    this.leaveRoom();
    // Reset map initialization flag and clear visuals so platforms will be rebuilt when rejoining
    this.mapInitialized = false;
    this.platformVisuals.forEach(visual => visual.destroy());
    this.platformVisuals = [];
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
}