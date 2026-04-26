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

  private bgMusic!: Phaser.Sound.BaseSound;
  private gameOverAudio?: HTMLAudioElement;
  private muteButton!: Phaser.GameObjects.Image;

  // Health system: 3 hearts × 4 quarters = 12 HP
  private readonly MAX_HEARTS = 3;
  private readonly QUARTERS_PER_HEART = 4;
  private health!: number;               // current HP in quarter-units
  private heartSprites: Phaser.GameObjects.Sprite[] = [];
  private invulnerable = false;
  private gameOverShown = false;
  private gameOverAudioUnlocked = false;

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
    this.load.audio('hurtSfx', 'assets/sounds/hurt.wav');

    // Background music
    this.load.audio('bgMusic', 'assets/music/time_for_adventure.mp3');

    // Mute button icons
    this.load.image('unmuted_button', 'assets/sprites/unmuted_button.png');
    this.load.image('muted_button', 'assets/sprites/muted_button.png');

    // Heart spritesheet (5 frames: full, 3/4, 1/2, 1/4, empty)
    this.load.spritesheet('heart', 'assets/sprites/heart_spritesheet_16x16.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  create() {
    // Sky background
    this.cameras.main.setBackgroundColor(0x87ceeb);

    void document.fonts?.load('32px PixelOperator8Bold');
    void document.fonts?.load('18px PixelOperator8Bold');

    this.gameOverAudio = new Audio('/assets/music/game_over.mp3');
    this.gameOverAudio.preload = 'auto';
    this.gameOverAudio.volume = 1;
    this.gameOverAudio.muted = this.sound.mute;
    this.gameOverAudio.load();

    const unlockGameOverAudio = () => {
      if (!this.gameOverAudio || this.gameOverAudioUnlocked) return;

      this.gameOverAudio.muted = true;
      void this.gameOverAudio.play()
        .then(() => {
          this.gameOverAudio?.pause();
          if (this.gameOverAudio) {
            this.gameOverAudio.currentTime = 0;
            this.gameOverAudio.muted = this.sound.mute;
          }
          this.gameOverAudioUnlocked = true;
        })
        .catch(() => {
          if (this.gameOverAudio) {
            this.gameOverAudio.muted = this.sound.mute;
          }
        });
    };

    this.input.once('pointerdown', unlockGameOverAudio);
    this.input.keyboard?.once('keydown', unlockGameOverAudio);

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
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.4 });
    this.bgMusic.play();

    // Mute toggle button (fixed to camera)
    this.muteButton = this.add.image(this.cameras.main.width - 10, 10, 'unmuted_button')
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.sound.mute = !this.sound.mute;
        if (this.gameOverAudio) {
          this.gameOverAudio.muted = this.sound.mute;
        }
        this.muteButton.setTexture(this.sound.mute ? 'muted_button' : 'unmuted_button');
      });

    // Health display
    this.health = this.MAX_HEARTS * this.QUARTERS_PER_HEART; // 12
    this.heartSprites = [];
    for (let i = 0; i < this.MAX_HEARTS; i++) {
      const heart = this.add.sprite(10 + i * 18, 10, 'heart', 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(1000);
      this.heartSprites.push(heart);
    }

    // Enemy overlap → take damage
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      this.takeDamage(1, enemy as Phaser.Physics.Arcade.Sprite);
    });
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

  /** Remove `amount` quarter-hearts of health and refresh the HUD. */
  private takeDamage(amount: number, source?: Phaser.Physics.Arcade.Sprite) {
    if (this.invulnerable || this.health <= 0) return;

    this.health = Math.max(0, this.health - amount);
    this.updateHeartDisplay();

    // Hurt sound
    this.sound.play('hurtSfx');

    // Knockback away from the damage source
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const knockX = source && source.x < this.player.x ? 200 : -200;
    body.setVelocity(knockX, -180);

    // Shake hearts
    for (const heart of this.heartSprites) {
      this.tweens.add({
        targets: heart,
        x: heart.x + 3,
        duration: 40,
        yoyo: true,
        repeat: 5,
        ease: 'Sine.easeInOut',
      });
    }

    // Brief invulnerability + flash
    this.invulnerable = true;
    this.player.setTint(0xff0000);
    this.time.delayedCall(1000, () => {
      this.invulnerable = false;
      this.player.clearTint();
    });

    if (this.health <= 0) {
      this.triggerGameOver();
    }
  }

  /** Enter the game over state once, even if optional audio failed to load. */
  private triggerGameOver() {
    if (this.gameOverShown) return;

    this.gameOverShown = true;
    this.invulnerable = true;
    this.player.setTint(0xff0000);
    this.physics.pause();

    if (this.bgMusic.isPlaying) {
      this.bgMusic.stop();
    }

    this.showGameOver();

    this.playGameOverMusic();
  }

  /** Play game-over music without depending on Phaser's audio cache. */
  private playGameOverMusic() {
    if (!this.gameOverAudio) {
      this.gameOverAudio = new Audio('/assets/music/game_over.mp3');
      this.gameOverAudio.preload = 'auto';
      this.gameOverAudio.volume = 1;
    }

    this.gameOverAudio.pause();
    this.gameOverAudio.currentTime = 0;
    this.gameOverAudio.muted = this.sound.mute;
    this.gameOverAudio.load();
    void this.gameOverAudio.play().catch(() => undefined);
  }

  /** Show a Game Over overlay with a "Try Again" button. */
  private showGameOver() {
    const cam = this.cameras.main;

    // Dark overlay
    this.add.rectangle(
      cam.width / 2, cam.height / 2,
      cam.width, cam.height,
      0x000000, 0.6,
    )
      .setScrollFactor(0)
      .setDepth(2000);

    // "GAME OVER" text
    this.add.text(cam.width / 2, cam.height / 2 - 20, 'GAME OVER', {
      fontSize: '32px',
      color: '#ff4444',
      fontFamily: 'PixelOperator8Bold',
      resolution: 3,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    // "Try Again" button
    const tryAgain = this.add.text(cam.width / 2, cam.height / 2 + 16, 'Try Again', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#444444',
      fontFamily: 'PixelOperator8Bold',
      padding: { x: 8, y: 4 },
      resolution: 3,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => tryAgain.setStyle({ backgroundColor: '#666666' }))
      .on('pointerout', () => tryAgain.setStyle({ backgroundColor: '#444444' }))
      .on('pointerdown', () => {
        this.sound.stopAll();
        if (this.gameOverAudio) {
          this.gameOverAudio.pause();
          this.gameOverAudio.currentTime = 0;
        }
        this.gameOverShown = false;
        this.scene.restart();
      });
  }

  /** Sync heart sprites with current health value. */
  private updateHeartDisplay() {
    for (let i = 0; i < this.MAX_HEARTS; i++) {
      const quartersLeft = Phaser.Math.Clamp(
        this.health - i * this.QUARTERS_PER_HEART,
        0,
        this.QUARTERS_PER_HEART,
      );
      // frame 0 = full (4/4), 1 = 3/4, 2 = 2/4, 3 = 1/4, 4 = empty (0/4)
      const frame = this.QUARTERS_PER_HEART - quartersLeft;
      this.heartSprites[i].setFrame(frame);
    }
  }
}
