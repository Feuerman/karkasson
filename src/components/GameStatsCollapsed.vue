<template>
  <div class="game-stats-collapsed">
    <template v-if="isOpened">
      <slot />
    </template>
    <button @click="isOpened = !isOpened">
      {{ !isOpened ? 'Показать' : 'Скрыть' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isOpened = ref(false)
</script>

<style scoped lang="scss">
.game-stats {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 2;
  width: 500px;
  height: 400px;
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  color: black;
  overflow: scroll;
}
</style>
