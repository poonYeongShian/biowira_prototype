import * as Phaser from 'phaser';

type EnemyState = 'patrol' | 'chase' | 'attack' | 'hurt' | 'dead';

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  // Stats
  public health = 3;
  public damage = 1;

  // Speeds
  private speed = 40;
  private chaseSpeed = 70;

  // AI ranges
  private aggroRange = 120;
  private attackRange = 20;
  private attackCooldown = 600;
  private canAttack = true;

  // Patrol
  private patrolDistance = 60;
  private patrolOriginX: number;
  private patrolDirection = 1;

  // State
  private aiState: EnemyState = 'patrol';
  private player: Phaser.Physics.Arcade.Sprite | null = null;
  private blockingLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private onDamagePlayer: ((damage: number) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'slime_green');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);

    this.body.setBounce(0);
    this.body.setSize(18, 14);
    this.body.setOffset(3, 10);

    this.patrolOriginX = x;
    this.play('slime_idle');
  }

  /** Call once from GameScene to give the enemy a target */
  setTarget(player: Phaser.Physics.Arcade.Sprite, blockingLayer?: Phaser.Tilemaps.TilemapLayer) {
    this.player = player;
    this.blockingLayer = blockingLayer ?? null;
  }

  /** Register a callback that is invoked each time the enemy lands an attack hit. */
  setDamageCallback(callback: (damage: number) => void) {
    this.onDamagePlayer = callback;
  }

  private hasLineOfSight() {
    if (!this.player || !this.blockingLayer) return true;

    const startX = this.x;
    const startY = this.y - 8;
    const endX = this.player.x;
    const endY = this.player.y - 8;
    const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
    const steps = Math.max(2, Math.ceil(distance / 8));

    for (let index = 1; index < steps; index += 1) {
      const t = index / steps;
      const sampleX = Phaser.Math.Linear(startX, endX, t);
      const sampleY = Phaser.Math.Linear(startY, endY, t);
      const tile = this.blockingLayer.getTileAtWorldXY(sampleX, sampleY, true);

      if (tile && tile.index !== -1 && tile.collides) {
        return false;
      }
    }

    return true;
  }

  // ---- State behaviours ----

  private updatePatrol() {
    const leftBound = this.patrolOriginX - this.patrolDistance;
    const rightBound = this.patrolOriginX + this.patrolDistance;

    this.setVelocityX(this.speed * this.patrolDirection);
    this.setFlipX(this.patrolDirection === -1);

    // Reverse on reaching patrol bounds
    if (this.x >= rightBound) this.patrolDirection = -1;
    if (this.x <= leftBound) this.patrolDirection = 1;

    // Reverse when hitting a wall
    if (this.body.blocked.left) this.patrolDirection = 1;
    if (this.body.blocked.right) this.patrolDirection = -1;

    // Reverse at platform edge (no ground ahead)
    if (this.body.blocked.down && this.blockingLayer) {
      const probeX = this.x + this.patrolDirection * 10;
      const probeY = this.y + 4;
      const tile = this.blockingLayer.getTileAtWorldXY(probeX, probeY, true);
      if (!tile || tile.index === -1 || !tile.collides) {
        this.patrolDirection *= -1;
        this.setVelocityX(0);
      }
    }

    this.anims.play('slime_idle', true);
  }

  private updateChase() {
    const dx = this.player!.x - this.x;

    if (dx > 0) {
      this.setVelocityX(this.chaseSpeed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(-this.chaseSpeed);
      this.setFlipX(true);
    }

    this.anims.play('slime_idle', true);
  }

  private updateAttack() {
    this.setVelocityX(0);

    // Always face the player while attacking
    this.setFlipX(this.player!.x < this.x);

    if (this.canAttack) {
      this.canAttack = false;

      // Orange flash to signal the hit
      this.setTint(0xff8800);
      this.scene.time.delayedCall(150, () => {
        if (this.active) this.clearTint();
      });

      this.onDamagePlayer?.(this.damage);

      this.scene.time.delayedCall(this.attackCooldown, () => {
        this.canAttack = true;
      });
    }

    this.anims.play('slime_idle', true);
  }

  // ---- Main loop ----

  update() {
    if (this.aiState === 'dead' || !this.player) return;
    if (this.aiState === 'hurt') return;

    const dx = this.player.x - this.x;
    const dist = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.player.x, this.player.y,
    );
    const hasLineOfSight = this.hasLineOfSight();

    if (dist <= this.attackRange && hasLineOfSight) {
      this.aiState = 'attack';
    } else if (Math.abs(dx) <= this.aggroRange && hasLineOfSight) {
      this.aiState = 'chase';
    } else {
      this.aiState = 'patrol';
    }

    switch (this.aiState) {
      case 'patrol':
        this.updatePatrol();
        break;
      case 'chase':
        this.updateChase();
        break;
      case 'attack':
        this.updateAttack();
        break;
    }
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health <= 0) {
      this.aiState = 'dead';
      this.destroy();
    }
  }
}
