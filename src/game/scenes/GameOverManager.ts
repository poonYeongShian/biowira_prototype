import * as Phaser from "phaser";

/** Handles the game-over state: overlay UI, music, and restart. */
export default class GameOverManager {
  private scene: Phaser.Scene;
  private gameOverAudio?: HTMLAudioElement;
  private gameOverAudioUnlocked = false;
  private gameOverShown = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.gameOverAudio = new Audio("/assets/music/game_over.mp3");
    this.gameOverAudio.preload = "auto";
    this.gameOverAudio.volume = 1;
    this.gameOverAudio.muted = scene.sound.mute;
    this.gameOverAudio.load();

    const unlock = () => {
      if (!this.gameOverAudio || this.gameOverAudioUnlocked) return;
      this.gameOverAudio.muted = true;
      void this.gameOverAudio
        .play()
        .then(() => {
          this.gameOverAudio?.pause();
          if (this.gameOverAudio) {
            this.gameOverAudio.currentTime = 0;
            this.gameOverAudio.muted = scene.sound.mute;
          }
          this.gameOverAudioUnlocked = true;
        })
        .catch(() => {
          if (this.gameOverAudio) {
            this.gameOverAudio.muted = scene.sound.mute;
          }
        });
    };

    scene.input.once("pointerdown", unlock);
    scene.input.keyboard?.once("keydown", unlock);
  }

  /** Sync mute state when player toggles sound. */
  syncMute(muted: boolean) {
    if (this.gameOverAudio) {
      this.gameOverAudio.muted = muted;
    }
  }

  /** Trigger game over: pause physics, stop bgMusic, show overlay. */
  trigger(
    bgMusic: Phaser.Sound.BaseSound,
    player: Phaser.Physics.Arcade.Sprite,
  ) {
    if (this.gameOverShown) return;

    this.gameOverShown = true;
    player.setTint(0xff0000);
    this.scene.physics.pause();

    if (bgMusic.isPlaying) {
      bgMusic.stop();
    }

    this.showOverlay();
    this.playMusic();
  }

  private playMusic() {
    if (!this.gameOverAudio) {
      this.gameOverAudio = new Audio("/assets/music/game_over.mp3");
      this.gameOverAudio.preload = "auto";
      this.gameOverAudio.volume = 1;
    }
    this.gameOverAudio.pause();
    this.gameOverAudio.currentTime = 0;
    this.gameOverAudio.muted = this.scene.sound.mute;
    this.gameOverAudio.load();
    void this.gameOverAudio.play().catch(() => undefined);
  }

  private showOverlay() {
    const cam = this.scene.cameras.main;

    this.scene.add
      .rectangle(
        cam.width / 2,
        cam.height / 2,
        cam.width,
        cam.height,
        0x000000,
        0.6,
      )
      .setScrollFactor(0)
      .setDepth(2000);

    this.scene.add
      .bitmapText(
        cam.width / 2,
        cam.height / 2 - 28,
        "nokia16",
        "GAME OVER",
        16,
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setTint(0xff4444)
      .setScale(2);

    const btnW = 80;
    const btnH = 20;
    const btnX = cam.width / 2;
    const btnY = cam.height / 2 + 16;
    const btnBg = this.scene.add
      .rectangle(btnX, btnY, btnW, btnH, 0x444444)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => btnBg.setFillStyle(0x666666))
      .on("pointerout", () => btnBg.setFillStyle(0x444444))
      .on("pointerdown", () => {
        this.scene.sound.stopAll();
        if (this.gameOverAudio) {
          this.gameOverAudio.pause();
          this.gameOverAudio.currentTime = 0;
        }
        this.gameOverShown = false;
        this.scene.scene.restart();
      });

    this.scene.add
      .bitmapText(btnX, btnY, "nokia16", "Try Again", 16)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2002)
      .setTint(0xffffff);
  }
}
