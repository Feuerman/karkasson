<template>
  <Draggable draggable-id="saved-games">
    <div v-for="savedGame in savedGames" :key="savedGame.id">
      <button>
        {{ savedGame.name }}
      </button>
      <button>x</button>
    </div>
    <input type="text" v-model="savedGameName" />
    <button>Save Game</button>
  </Draggable>
</template>
<script setup lang="ts">
import { defineProps, ref } from 'vue'
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import Draggable from '@/components/Draggable.vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const savedGameName = ref('')

const savedGames = ref([])
</script>
