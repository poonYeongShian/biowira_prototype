import * as Phaser from "phaser";
import Enemy from "../entities/Enemy";
import { createAnimations } from "./AnimationSetup";
import HealthDisplay from "./HealthDisplay";
import GameOverManager from "./GameOverManager";

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
  private muteButton!: Phaser.GameObjects.Image;
  private healthDisplay!: HealthDisplay;
  private gameOverManager!: GameOverManager;

  private readonly PLAYER_SPEED = 300;
  private readonly JUMP_VELOCITY = -340;

  constructor() {
    super({ key: "GameScene" });
  }

  private configureCharacterBody(
    sprite: Phaser.Physics.Arcade.Sprite,
    scale = 1,
  ) {
    sprite.setScale(scale);
    sprite.setOrigin(0.5, 1);
    sprite.setCollideWorldBounds(true);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0);
    body.setSize(12, 14);
    body.setOffset(10, 14);
  }

  preload() {
    this.load.tilemapTiledJSON("level1", "assets/tilemaps/level1.json");
    this.load.image("platformer-tiles", "assets/tilesets/world_tileset.png");

    this.load.spritesheet("knight", "assets/sprites/knight.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("slime_green", "assets/sprites/slime_green.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("slime_purple", "assets/sprites/slime_purple.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("coin", "assets/sprites/coin.png", {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.audio("jumpSfx", "assets/sounds/jump.wav");
    this.load.audio("hurtSfx", "assets/sounds/hurt.wav");
    this.load.audio("bgMusic", "assets/music/time_for_adventure.mp3");

    this.load.image("unmuted_button", "assets/sprites/unmuted_button.png");
    this.load.image("muted_button", "assets/sprites/muted_button.png");

    this.load.spritesheet(
      "heart",
      "assets/sprites/heart_spritesheet_16x16.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );

    this.load.bitmapFont(
      "nokia16",
      "assets/fonts/nokia16.png",
      "assets/fonts/nokia16.xml",
    );
  }

  create() {
    this.cameras.main.setBackgroundColor(0x87ceeb);

    // Managers
    this.gameOverManager = new GameOverManager(this);
    createAnimations(this);

    // --- Tilemap setup ---
    const map = this.make.tilemap({ key: "level1" });
    const tileset = map.addTilesetImage("platformer", "platformer-tiles")!;

    map.createLayer("Background", tileset, 0, 0);
    map.createLayer("Decorations", tileset, 0, 0);
    this.platformLayer = map.createLayer("Platforms", tileset, 0, 0)!;
    this.platformLayer.setCollisionByExclusion([-1, 0]);

    // --- Player setup ---
    const objects = map.getObjectLayer("Objects")!.objects;
    const playerStart = objects.find((obj) => obj.name === "player_start");
    const startX = playerStart ? playerStart.x! : 21;
    const startY = playerStart ? playerStart.y! : 215;

    this.player = this.physics.add.sprite(startX, startY - 1, "knight");
    this.configureCharacterBody(this.player);
    this.player.setPosition(
      Phaser.Math.Clamp(
        startX,
        this.player.displayWidth / 2,
        map.widthInPixels - this.player.displayWidth / 2,
      ),
      startY - 1,
    );
    this.physics.add.collider(this.player, this.platformLayer);

    // --- Spawn objects ---
    this.enemies = this.physics.add.group();
    this.allies = this.physics.add.group();
    this.coins = this.add.group();

    objects.forEach((obj) => {
      if (obj.type === "enemy") {
        const enemy = new Enemy(this, obj.x!, obj.y! - 1);
        enemy.setTarget(this.player, this.platformLayer);
        this.enemies.add(enemy);
        this.enemyInstances.push(enemy);
      }
      if (obj.type === "ally") {
        const ally = this.physics.add.sprite(
          obj.x!,
          obj.y! - 1,
          "slime_purple",
        );
        ally.setOrigin(0.5, 1);
        ally.setCollideWorldBounds(true);
        const abody = ally.body as Phaser.Physics.Arcade.Body;
        abody.setBounce(0);
        abody.setSize(18, 14);
        abody.setOffset(3, 10);
        ally.play("slime_purple_idle");
        this.allies.add(ally);
      }
      if (obj.type === "coin") {
        const coin = this.add.sprite(obj.x!, obj.y! - 6, "coin");
        coin.setOrigin(0.5, 1);
        coin.play("coin_spin");
        this.coins.add(coin);
      }
      if (obj.type === "trigger" && obj.name === "level_end") {
        this.levelEnd = this.physics.add.sprite(obj.x!, obj.y!, "__DEFAULT");
        this.levelEnd.setDisplaySize(16, 16).setTint(0xff00ff);
        (this.levelEnd.body as Phaser.Physics.Arcade.Body).setAllowGravity(
          false,
        );
      }
    });

    this.physics.add.collider(this.enemies, this.platformLayer);
    this.physics.add.collider(this.allies, this.platformLayer);

    // Camera & world bounds
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.player.play("idle");

    // Background music
    this.bgMusic = this.sound.add("bgMusic", { loop: true, volume: 0.4 });
    this.bgMusic.play();

    // Mute toggle button
    this.muteButton = this.add
      .image(this.cameras.main.width - 10, 10, "unmuted_button")
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.sound.mute = !this.sound.mute;
        this.gameOverManager.syncMute(this.sound.mute);
        this.muteButton.setTexture(
          this.sound.mute ? "muted_button" : "unmuted_button",
        );
      });

    // Health HUD
    this.healthDisplay = new HealthDisplay(this);

    // Enemy overlap → take damage
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      const died = this.healthDisplay.takeDamage(
        1,
        this.player,
        enemy as Phaser.Physics.Arcade.Sprite,
      );
      if (died) {
        this.gameOverManager.trigger(this.bgMusic, this.player);
      }
    });
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.PLAYER_SPEED);
      this.player.setFlipX(true);
      if (body.blocked.down) this.player.play("run", true);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.PLAYER_SPEED);
      this.player.setFlipX(false);
      if (body.blocked.down) this.player.play("run", true);
    } else {
      body.setVelocityX(0);
      if (body.blocked.down) this.player.play("idle", true);
    }

    if (
      (this.cursors.up.isDown || this.cursors.space.isDown) &&
      body.blocked.down
    ) {
      body.setVelocityY(this.JUMP_VELOCITY);
      this.sound.play("jumpSfx");
    }

    for (const enemy of this.enemyInstances) {
      if (enemy.active) enemy.update();
    }
  }
}
