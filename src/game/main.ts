import * as Phaser from 'phaser';
import GameScene from './scenes/GameScene';

export function launchGame(parent: string | HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 480,
    height: 256,
    parent,
    backgroundColor: 0x87ceeb,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 800 },
        debug: false,
      },
    },
    scene: [GameScene],
  });
}
