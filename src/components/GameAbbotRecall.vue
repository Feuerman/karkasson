<template>
  <Draggable
    v-if="showRecall"
    draggable-id="abbot-recall"
    :initial-x="400"
    :initial-y="10"
  >
    <div
      class="panel-parchment min-w-[220px] max-w-[300px] p-3 text-text shadow-card"
    >
      <div class="mb-2 flex items-center gap-2">
        <UIcon name="i-lucide-church" class="h-5 w-5 text-gold-dark" />
        <span class="title-medieval text-[.95rem] leading-none">
          Отзыв аббата
        </span>
      </div>
      <p class="mb-2 text-[13px] text-text-muted">
        Снять аббата с монастыря и получить
        {{ potentialPoints }} очк{{ pluralSuffix }}.
      </p>
      <UButton
        block
        color="primary"
        variant="soft"
        class="btn-primary-action min-h-10 w-full cursor-pointer rounded-lg px-4 font-semibold"
        @click="recall"
      >
        Забрать аббата
      </UButton>
    </div>
  </Draggable>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const myAbbot = computed(() => {
  const board = props.gameBoard
  if (!board.isMyTurn) return null
  const me = board.currentPlayer
  if (!me) return null

  return (
    (board.placedFollowers ?? []).find(
      (follower) =>
        follower.isAbbot && String(follower.playerId) === String(me.id)
    ) ?? null
  )
})

const showRecall = computed(() => myAbbot.value !== null)

const potentialPoints = computed(() => {
  const abbot = myAbbot.value
  if (!abbot) return 0
  const stats = props.gameBoard.tilePlacesStats ?? {}
  const x = abbot.point.x
  const y = abbot.point.y

  let count = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (stats[y + dy]?.[x + dx]) count++
    }
  }
  return count
})

const pluralSuffix = computed(() => {
  const n = potentialPoints.value % 10
  const n2 = potentialPoints.value % 100
  if (n2 >= 11 && n2 <= 19) return 'ов'
  if (n === 1) return 'о'
  if (n >= 2 && n <= 4) return 'а'
  return 'ов'
})

const recall = () => {
  GameService.recallAbbot()
}
</script>
