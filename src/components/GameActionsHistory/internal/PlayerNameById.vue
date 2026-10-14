<template>
  <!-- Имя игрока выводится всегда, слот дописывает продолжение после него. -->
  <PlayerName :color="color" :title="title"> {{ name }}<slot /> </PlayerName>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { HISTORY_PLAYERS_KEY, playerById } from './players'
import PlayerName from './PlayerName.vue'

const props = defineProps<{
  playerId: string | number
  title?: string
}>()

const players = inject(HISTORY_PLAYERS_KEY)

if (!players) {
  throw new Error('PlayerNameById должен находиться внутри истории ходов')
}

const player = computed(() => playerById(players.value, props.playerId))

const color = computed(() => player.value?.color)
const name = computed(() => player.value?.name)
</script>
