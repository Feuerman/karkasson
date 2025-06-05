<template>
  <Draggable draggable-id="saved-games">
    <div v-for="savedGame in savedGames" :key="savedGame.id">
      <button @click="gameBoard.loadGame(savedGame.id)">
        {{ savedGame.name }}
      </button>
      <button @click="deleteGame(savedGame.id)">x</button>
    </div>
    <input type="text" v-model="savedGameName" />
    <button @click="gameBoard.saveGame(savedGameName)">Save Game</button>
  </Draggable>
</template>
<script setup lang="ts">
import { defineProps, onMounted, ref } from 'vue'
import { type IGameBoard } from '@/modules/GameBoard.js'
import Draggable from '@/components/Draggable.vue'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const savedGameName = ref('')

const savedGames = ref([])

const deleteGame = (id: number) => {
  props.gameBoard.deleteGame(id)
  savedGames.value = props.gameBoard.getSavedGames()
}

onMounted(() => {
  savedGames.value = [...props.gameBoard.getSavedGames()]
    .filter((game) => game.name.includes('auto-play'))
    .sort((a, b) => {
      return b.name.split(' ')[11] - a.name.split(' ')[11]
    })
    .map((game) => ({
      ...game,
      name:
        game.name +
        '   ||   ' +
        (+game.name.split(' ')[1] +
          +game.name.split(' ')[2] +
          +game.name.split(' ')[3] +
          +game.name.split(' ')[4]),
    }))
})
</script>
