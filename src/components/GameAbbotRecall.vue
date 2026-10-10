<template>
  <GamePanel
    v-if="showRecall"
    draggable-id="abbot-recall"
    :initial-x="initialX"
    :initial-y="16"
    :drag-enabled="dragEnabled"
    icon="i-lucide-church"
    title="Отзыв аббата"
    surface-class="min-w-[220px] max-w-[300px] p-3"
  >
    <p class="mb-2 text-[.9rem] leading-relaxed text-text-muted">
      Снять аббата с {{ abbotLocation }} и получить {{ potentialPoints }} очк{{
        pluralSuffix
      }}.
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
  </GamePanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IGameBoard } from '@/types/game'
import GamePanel from '@/components/GamePanel.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { pluralForm } from '@/utils/common'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
  dragEnabled: {
    type: Boolean,
    default: false,
  },
})

const initialX = Math.max(0, (window.innerWidth - 260) / 2)

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

const abbotLocation = computed(() =>
  myAbbot.value?.isGarden ? 'сада' : 'монастыря'
)

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

const pluralSuffix = computed(() =>
  pluralForm(potentialPoints.value, 'о', 'а', 'ов')
)

const recall = () => {
  GameService.recallAbbot()
}
</script>
