<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { launchGame } from '../game/main';
import type Phaser from 'phaser';

const gameContainer = ref<HTMLDivElement>();
let game: Phaser.Game | null = null;

onMounted(() => {
  if (gameContainer.value) {
    game = launchGame(gameContainer.value);
  }
});

onUnmounted(() => {
  game?.destroy(true);
  game = null;
});
</script>

<template>
  <div ref="gameContainer" class="game-container"></div>
</template>

<style scoped>
.game-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
