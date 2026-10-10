<template>
  <PlayerName :color="color" :title="title">
    <slot>{{ name }}</slot>
  </PlayerName>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '@server/modules/types'
import { playerById } from './players'
import PlayerName from './PlayerName.vue'

const props = defineProps<{
  players: Player[]
  playerId: string | number
  title?: string
}>()

const player = computed(() => playerById(props.players, props.playerId))

const color = computed(() => player.value?.color)
const name = computed(() => player.value?.name)
</script>
