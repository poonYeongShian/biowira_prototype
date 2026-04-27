import * as Phaser from "phaser";

/** Manages the heart-based health HUD and damage logic. */
export default class HealthDisplay {
  private readonly MAX_HEARTS = 3;
  private readonly QUARTERS_PER_HEART = 4;
  private health: number;
  private heartSprites: Phaser.GameObjects.Sprite[] = [];
  private invulnerable = false;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.health = this.MAX_HEARTS * this.QUARTERS_PER_HEART;

    for (let i = 0; i < this.MAX_HEARTS; i++) {
      const heart = scene.add
        .sprite(10 + i * 18, 10, "heart", 0)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(1000);
      this.heartSprites.push(heart);
    }
  }

  get currentHealth() {
    return this.health;
  }

  get isInvulnerable() {
    return this.invulnerable;
  }

  get isDead() {
    return this.health <= 0;
  }

  /** Apply damage, knockback, and invulnerability to the player. Returns true if player died. */
  takeDamage(
    amount: number,
    player: Phaser.Physics.Arcade.Sprite,
    source?: Phaser.Physics.Arcade.Sprite,
  ): boolean {
    if (this.invulnerable || this.health <= 0) return false;

    this.health = Math.max(0, this.health - amount);
    this.updateHeartDisplay();

    this.scene.sound.play("hurtSfx");

    // Knockback
    const body = player.body as Phaser.Physics.Arcade.Body;
    const knockX = source && source.x < player.x ? 200 : -200;
    body.setVelocity(knockX, -180);

    // Shake hearts
    for (const heart of this.heartSprites) {
      this.scene.tweens.add({
        targets: heart,
        x: heart.x + 3,
        duration: 40,
        yoyo: true,
        repeat: 5,
        ease: "Sine.easeInOut",
      });
    }

    // Invulnerability + flash
    this.invulnerable = true;
    player.setTint(0xff0000);
    this.scene.time.delayedCall(1000, () => {
      this.invulnerable = false;
      player.clearTint();
    });

    return this.health <= 0;
  }

  private updateHeartDisplay() {
    for (let i = 0; i < this.MAX_HEARTS; i++) {
      const quartersLeft = Phaser.Math.Clamp(
        this.health - i * this.QUARTERS_PER_HEART,
        0,
        this.QUARTERS_PER_HEART,
      );
      const frame = this.QUARTERS_PER_HEART - quartersLeft;
      this.heartSprites[i].setFrame(frame);
    }
  }
}
