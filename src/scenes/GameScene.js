// GameScene - Main gameplay
import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Step 1: Create the tilemap
    const map = this.make.tilemap({ key: 'level1' });

    // Step 2: Add tileset to the map ('platformer' matches name in tileset data)
    const tileset = map.addTilesetImage('platformer', 'platformer-tiles');

    // Step 3: Create each layer by name (must match Tiled layer names!)
    const backgroundLayer = map.createLayer('Background', tileset, 0, 0);
    const decorLayer      = map.createLayer('Decorations', tileset, 0, 0);
    const platformLayer   = map.createLayer('Platforms', tileset, 0, 0);

    // Step 4: Enable collision on all non-empty tiles in Platforms layer
    // (collides is a layer-level property, so we use setCollisionByExclusion)
    platformLayer.setCollisionByExclusion([-1, 0]);

    // Step 5: Spawn objects from Objects layer
    const objects = map.getObjectLayer('Objects').objects;

    // Find player_start and create player there
    const playerStart = objects.find(obj => obj.name === 'player_start');
    const startX = playerStart ? playerStart.x : 21;
    const startY = playerStart ? playerStart.y : 215;

    // Create a simple player sprite (placeholder until Player entity class is built)
    this.player = this.physics.add.sprite(startX, startY, '__DEFAULT');
    this.player.setDisplaySize(14, 14);
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(300);

    // Step 6: Collide player with platforms
    this.physics.add.collider(this.player, platformLayer);

    // Step 7: Spawn enemies, allies, coins, triggers
    this.enemies = this.physics.add.group();
    this.allies  = this.physics.add.group();
    this.coins   = this.physics.add.group();

    objects.forEach(obj => {
      if (obj.type === 'enemy') {
        const enemy = this.physics.add.sprite(obj.x, obj.y, '__DEFAULT');
        enemy.setDisplaySize(14, 14).setTint(0xff0000);
        enemy.body.setGravityY(300);
        this.enemies.add(enemy);
      }
      if (obj.type === 'ally') {
        const ally = this.physics.add.sprite(obj.x, obj.y, '__DEFAULT');
        ally.setDisplaySize(14, 14).setTint(0x00ff00);
        ally.body.setGravityY(300);
        this.allies.add(ally);
      }
      if (obj.type === 'coin') {
        const coin = this.physics.add.sprite(obj.x, obj.y, '__DEFAULT');
        coin.setDisplaySize(10, 10).setTint(0xffff00);
        coin.body.setAllowGravity(false);
        this.coins.add(coin);
      }
      if (obj.type === 'trigger' && obj.name === 'level_end') {
        this.levelEnd = this.physics.add.sprite(obj.x, obj.y, '__DEFAULT');
        this.levelEnd.setDisplaySize(16, 16).setTint(0xff00ff);
        this.levelEnd.body.setAllowGravity(false);
      }
    });

    // Collide groups with platforms
    this.physics.add.collider(this.enemies, platformLayer);
    this.physics.add.collider(this.allies, platformLayer);

    // Step 8: Set camera & world bounds to map size
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Step 9: Basic player movement (arrow keys)
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    const speed = 120;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown && this.player.body.blocked.down) {
      this.player.setVelocityY(-250);
    }
  }
}
