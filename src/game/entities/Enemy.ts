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
  private attackCooldown = 1000;
  private canAttack = true;

  // Patrol
  private patrolDistance = 60;
  private patrolOriginX: number;
  private patrolDirection = 1;

  // State
  private aiState: EnemyState = 'patrol';
  private player: Phaser.Physics.Arcade.Sprite | null = null;

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
  setTarget(player: Phaser.Physics.Arcade.Sprite) {
    this.player = player;
  }

  // ---- State behaviours ----

  private updatePatrol() {
    const leftBound = this.patrolOriginX - this.patrolDistance;
    const rightBound = this.patrolOriginX + this.patrolDistance;

    this.setVelocityX(this.speed * this.patrolDirection);
    this.setFlipX(this.patrolDirection === -1);

    if (this.x >= rightBound) this.patrolDirection = -1;
    if (this.x <= leftBound) this.patrolDirection = 1;

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

    if (this.canAttack) {
      this.canAttack = false;

      // TODO: call player.takeDamage(this.damage) once Player entity exists
      this.scene.time.delayedCall(this.attackCooldown, () => {
        this.canAttack = true;
      });
    }
  }

  // ---- Main loop ----

  update() {
    if (this.aiState === 'dead' || !this.player) return;
    if (this.aiState === 'hurt') return;

    const dist = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.player.x, this.player.y,
    );

    if (dist <= this.attackRange) {
      this.aiState = 'attack';
    } else if (dist <= this.aggroRange) {
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
