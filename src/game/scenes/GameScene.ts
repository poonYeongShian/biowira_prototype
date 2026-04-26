import * as Phaser from 'phaser';
import Enemy from '../entities/Enemy';

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private platformLayer!: Phaser.Tilemaps.TilemapLayer;

  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyInstances: Enemy[] = [];
  private allies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.GameObjects.Group;
  private levelEnd?: Phaser.Physics.Arcade.Sprite;

  private readonly PLAYER_SPEED = 300;
  private readonly JUMP_VELOCITY = -340;

  constructor() {
    super({ key: 'GameScene' });
  }

  private configureCharacterBody(sprite: Phaser.Physics.Arcade.Sprite, scale = 1) {
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 1);
    sprite.setCollideWorldBounds(true);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0);
    body.setSize(12, 14);
    body.setOffset(10, 14);
  }

  preload() {
    // Tilemap & tileset
    this.load.tilemapTiledJSON('level1', 'assets/tilemaps/level1.json');
    this.load.image('platformer-tiles', 'assets/tilesets/world_tileset.png');

    // Player sprite
    this.load.spritesheet('knight', 'assets/sprites/knight.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Enemy sprite
    this.load.spritesheet('slime_green', 'assets/sprites/slime_green.png', {
      frameWidth: 24,
      frameHeight: 24,
    });

    // Ally sprite
    this.load.spritesheet('slime_purple', 'assets/sprites/slime_purple.png', {
      frameWidth: 24,
      frameHeight: 24,
    });

    // Coin sprite
    this.load.spritesheet('coin', 'assets/sprites/coin.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // Sound effects
    this.load.audio('jumpSfx', 'assets/sounds/jump.wav');

    // Background music
    this.load.audio('bgMusic', 'assets/music/time_for_adventure.mp3');
  }

  create() {
    // Sky background
    this.cameras.main.setBackgroundColor(0x87ceeb);

    // --- Tilemap setup ---
    const map = this.make.tilemap({ key: 'level1' });
    const tileset = map.addTilesetImage('platformer', 'platformer-tiles')!;

    map.createLayer('Background', tileset, 0, 0);
    map.createLayer('Decorations', tileset, 0, 0);
    this.platformLayer = map.createLayer('Platforms', tileset, 0, 0)!;

    // All non-empty tiles in Platforms are collidable
    this.platformLayer.setCollisionByExclusion([-1, 0]);

    // --- Spawn objects from Tiled Objects layer ---
    const objects = map.getObjectLayer('Objects')!.objects;
    const playerStart = objects.find(obj => obj.name === 'player_start');
    const startX = playerStart ? playerStart.x! : 21;
    const startY = playerStart ? playerStart.y! : 215;

    // Player sprite
    this.player = this.physics.add.sprite(startX, startY - 1, 'knight');
    this.configureCharacterBody(this.player);
    this.player.setPosition(
      Phaser.Math.Clamp(startX, this.player.displayWidth / 2, map.widthInPixels - this.player.displayWidth / 2),
      startY - 1,
    );

    // Collide player with platforms
    this.physics.add.collider(this.player, this.platformLayer);

    // Slime animations (must be created before spawning)
    this.anims.create({
      key: 'slime_idle',
      frames: this.anims.generateFrameNumbers('slime_green', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'slime_purple_idle',
      frames: this.anims.generateFrameNumbers('slime_purple', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'coin_spin',
      frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 11 }),
      frameRate: 12,
      repeat: -1,
    });

    // Spawn enemies, allies, coins, level_end
    this.enemies = this.physics.add.group();
    this.allies  = this.physics.add.group();
    this.coins   = this.add.group();

    objects.forEach(obj => {
      if (obj.type === 'enemy') {
        const enemy = new Enemy(this, obj.x!, obj.y! - 1);
        enemy.setTarget(this.player, this.platformLayer);
        this.enemies.add(enemy);
        this.enemyInstances.push(enemy);
      }
      if (obj.type === 'ally') {
        const ally = this.physics.add.sprite(obj.x!, obj.y! - 1, 'slime_purple');
        ally.setOrigin(0.5, 1);
        ally.setCollideWorldBounds(true);
        const abody = ally.body as Phaser.Physics.Arcade.Body;
        abody.setBounce(0);
        abody.setSize(18, 14);
        abody.setOffset(3, 10);
        ally.play('slime_purple_idle');
        this.allies.add(ally);
      }
      if (obj.type === 'coin') {
        const coin = this.add.sprite(obj.x!, obj.y! - 6, 'coin');
        coin.setOrigin(0.5, 1);
        coin.play('coin_spin');
        this.coins.add(coin);
      }
      if (obj.type === 'trigger' && obj.name === 'level_end') {
        this.levelEnd = this.physics.add.sprite(obj.x!, obj.y!, '__DEFAULT');
        this.levelEnd.setDisplaySize(16, 16).setTint(0xff00ff);
        (this.levelEnd.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      }
    });

    // Collide groups with platforms
    this.physics.add.collider(this.enemies, this.platformLayer);
    this.physics.add.collider(this.allies, this.platformLayer);

    // Camera & world bounds follow the map
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Animations
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'run',
      frames: this.anims.generateFrameNumbers('knight', { start: 16, end: 23 }),
      frameRate: 12,
      repeat: -1,
    });

    this.player.play('idle');

    // Background music
    this.sound.play('bgMusic', { loop: true, volume: 0.4 });
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // Left / Right movement
    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.PLAYER_SPEED);
      this.player.setFlipX(true);
      if (body.blocked.down) this.player.play('run', true);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.PLAYER_SPEED);
      this.player.setFlipX(false);
      if (body.blocked.down) this.player.play('run', true);
    } else {
      body.setVelocityX(0);
      if (body.blocked.down) this.player.play('idle', true);
    }

    // Jump — only when standing on the ground
    if ((this.cursors.up.isDown || this.cursors.space.isDown) && body.blocked.down) {
      body.setVelocityY(this.JUMP_VELOCITY);
      this.sound.play('jumpSfx');
    }

    // Update enemy AI
    for (const enemy of this.enemyInstances) {
      if (enemy.active) enemy.update();
    }
  }
}
