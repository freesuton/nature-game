import { Scene } from 'phaser';
import { Player } from '../sprites/Player';
import { Bullet } from '../sprites/Bullet';
import { Enemy } from '../sprites/Enemy';

export interface GameState {
  player: Player;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  bullets: Phaser.Physics.Arcade.Group;
  enemies?: Phaser.Physics.Arcade.Group; // Optional for multiplayer compatibility
  shootKey: Phaser.Input.Keyboard.Key;
  lastShotTime: number;
  shotCooldown: number;
}

export class GameLogic {
  static preloadAssets(scene: Scene) {
    scene.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
    scene.load.spritesheet('player', 
      'https://labs.phaser.io/assets/sprites/dude.png',
      { frameWidth: 32, frameHeight: 48 }
    );
    scene.load.image('bullet', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFYSURBVBiVY/z//z8DJQAggJiYmBgZGRkZGBgYGFatWsVAKQAQQIxMTEwMf//+Zfjx4wfD379/GX7//s3w+/dvBkoAQAAxMjIyMvz484fh27dvDJ8/f2b48uULw5cvXxi+fv3K8P37dwZKAUAAYmRkZGT4+fMnw6dPnxg+fvzI8OHDB4b379+zf/nyhYFSABBAjIyMjAw/fvxg+PDhA8O7d+8Y3r59y/DmzRuG169fM7x69Yrh5cuXDJQCgABiZGRkZPjy5QvDy5cvGV68eMHw/PlzhqdPnzI8efKE4fHjxwyPHj1iePjwIQOlACCAGBkZGRmePXvG8OjRI4aHDx8yPHjwgOH+/fsM9+7dY7h79y7DnTt3GO7cucNAKQAIIEZGRkaGO3fuMNy5c4fh9u3bDLdu3WK4efMmw40bNxiuX7/OcO3aNYZr164xUAoAAoiRkZGR4dq1awzXrl1juHr1KsPVq1cZrly5wnD58mWGy5cvM1y6dImBUgAQQABxoK9zYQQAAAABJRU5ErkJggg==');
  }

  static createWorld(scene: Scene, includeEnemies: boolean = false): GameState {
    // Create platforms
    const platforms = scene.physics.add.staticGroup();
    
    // Create ground
    platforms.create(400, 568, 'ground').setScale(2).refreshBody();

    // Create some platforms
    platforms.create(600, 400, 'ground');
    platforms.create(50, 250, 'ground');
    platforms.create(750, 220, 'ground');

    // Create player
    const player = new Player(scene, 100, 450);

    // Create bullets group
    const bullets = scene.physics.add.group({
      classType: Bullet,
      maxSize: 10,
      runChildUpdate: true
    });

    // Add collision between player and platforms
    scene.physics.add.collider(player, platforms);

    let enemies: Phaser.Physics.Arcade.Group | undefined;
    
    if (includeEnemies) {
      // Create enemies group
      enemies = scene.physics.add.group({
        classType: Enemy,
        runChildUpdate: true
      });

      // Add collision between enemies and platforms
      scene.physics.add.collider(enemies, platforms);

      // Add collision between bullets and enemies
      scene.physics.add.overlap(bullets, enemies, (bullet, enemy) => {
        bullet.destroy();
        enemy.destroy();
      });

      // Spawn initial enemies
      this.spawnEnemies(scene, enemies, platforms);
    }

    // Set up keyboard input
    const cursors = scene.input.keyboard!.createCursorKeys();
    const shootKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);

    // Set up camera to follow player
    scene.cameras.main.startFollow(player, true, 0.08, 0.08);
    scene.cameras.main.setDeadzone(100, 100);

    return {
      player,
      platforms,
      cursors,
      bullets,
      enemies,
      shootKey,
      lastShotTime: 0,
      shotCooldown: 200
    };
  }

  static handleMovement(
    gameState: GameState, 
    onMove?: () => void, 
    onStop?: () => void, 
    onJump?: () => void
  ): void {
    const { player, cursors } = gameState;
    
    if (!player || !cursors) {
      return;
    }

    let isMoving = false;

    // Handle player movement
    if (cursors.left.isDown) {
      player.moveLeft();
      isMoving = true;
    } else if (cursors.right.isDown) {
      player.moveRight();
      isMoving = true;
    } else {
      player.stop();
    }

    // Handle jumping - check if player is on ground or platform
    const onGround = player.body && (player.body.touching.down || player.body.blocked.down);
    if (Phaser.Input.Keyboard.JustDown(cursors.up) && onGround) {
      player.jump();
      onJump?.();
    }

    // Additional controls - WASD support
    const scene = player.scene;
    const wasd = scene.input.keyboard!.addKeys('W,S,A,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    
    if (wasd.A.isDown) {
      player.moveLeft();
      isMoving = true;
    } else if (wasd.D.isDown) {
      player.moveRight();
      isMoving = true;
    }
    
    if (Phaser.Input.Keyboard.JustDown(wasd.W) && onGround) {
      player.jump();
      onJump?.();
    }

    // Call movement callbacks
    if (isMoving && onMove) {
      onMove();
    } else if (!isMoving && onStop) {
      onStop();
    }
  }

  static handleShooting(
    gameState: GameState, 
    scene: Scene, 
    onShoot?: (x: number, y: number, direction: number) => void
  ): void {
    const { player, bullets, shootKey, shotCooldown } = gameState;
    
    if (shootKey.isDown && scene.time.now > gameState.lastShotTime + shotCooldown) {
      const spawnPos = player.getBulletSpawnPosition();
      
      // Get or create a bullet from the pool
      const bullet = bullets.get(spawnPos.x, spawnPos.y) as Bullet;
      
      if (bullet) {
        bullet.fire(spawnPos.x, spawnPos.y, player.facingDirection);
        gameState.lastShotTime = scene.time.now;
        onShoot?.(spawnPos.x, spawnPos.y, player.facingDirection);
      }
    }
  }

  static spawnEnemies(scene: Scene, enemies: Phaser.Physics.Arcade.Group, platforms: Phaser.Physics.Arcade.StaticGroup): void {
    // Spawn enemies on different platforms
    const spawnPositions = [
      { x: 600, y: 350 }, // On middle platform
      { x: 50, y: 200 },  // On left platform
      { x: 750, y: 170 }, // On right platform
      { x: 300, y: 520 }, // On ground
      { x: 500, y: 520 }  // On ground
    ];

    spawnPositions.forEach(pos => {
      const enemy = new Enemy(scene, pos.x, pos.y);
      enemies.add(enemy);
    });
  }

  static updateEnemies(gameState: GameState): void {
    if (gameState.enemies) {
      gameState.enemies.children.entries.forEach((enemy) => {
        if (enemy instanceof Enemy) {
          enemy.update();
        }
      });
    }
  }
}