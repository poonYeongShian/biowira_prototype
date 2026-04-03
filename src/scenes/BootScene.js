// BootScene - Load assets
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load the tilemap JSON
    this.load.tilemapTiledJSON('level1', 'assets/tilemaps/level1.json');

    // Load the tileset image (world_tileset.png is the actual image used by platformer.tsx)
    this.load.image('platformer-tiles', 'assets/tilesets/world_tileset.png');
  }

  create() {
    this.scene.start('GameScene');
  }
}
