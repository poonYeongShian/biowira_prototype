import * as Phaser from "phaser";

/** Creates all shared sprite animations used by the game (skips if already registered). */
export function createAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists("idle")) return;

  scene.anims.create({
    key: "slime_idle",
    frames: scene.anims.generateFrameNumbers("slime_green", {
      start: 0,
      end: 3,
    }),
    frameRate: 6,
    repeat: -1,
  });

  scene.anims.create({
    key: "slime_purple_idle",
    frames: scene.anims.generateFrameNumbers("slime_purple", {
      start: 0,
      end: 3,
    }),
    frameRate: 6,
    repeat: -1,
  });

  scene.anims.create({
    key: "coin_spin",
    frames: scene.anims.generateFrameNumbers("coin", { start: 0, end: 11 }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: "idle",
    frames: scene.anims.generateFrameNumbers("knight", { start: 0, end: 3 }),
    frameRate: 6,
    repeat: -1,
  });

  scene.anims.create({
    key: "run",
    frames: scene.anims.generateFrameNumbers("knight", { start: 16, end: 23 }),
    frameRate: 12,
    repeat: -1,
  });
}
