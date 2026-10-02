<template>
  <Draggable
    v-if="gameBoard.dragonMove || gameBoard.princessChoice"
    draggable-id="princess-and-dragon-actions"
    :initial-x="16"
    :initial-y="170"
    :drag-enabled="dragEnabled"
  >
    <section
      class="panel-parchment min-w-[240px] max-w-[320px] space-y-2 p-3 text-text shadow-card"
      aria-live="polite"
    >
      <div v-if="gameBoard.dragonMove">
        <h2 class="title-medieval text-base">Движение дракона</h2>
        <p class="text-sm text-text-muted">
          Выберите соседний выложенный тайл на игровом поле. Осталось шагов:
          {{ gameBoard.dragonMove.remainingSteps }}.
        </p>
      </div>

      <div v-if="gameBoard.princessChoice" class="space-y-1.5">
        <h2 class="title-medieval text-base">Принцесса</h2>
        <p class="text-sm text-text-muted">
          Выберите город, из которого нужно снять подданного.
        </p>
        <UButton
          v-for="(follower, index) in gameBoard.princessChoice.followers"
          :key="`${follower.cityId}-${follower.point.x}-${follower.point.y}-${index}`"
          block
          variant="ghost"
          class="btn-choice cursor-pointer justify-start font-semibold text-text"
          :disabled="!gameBoard.isMyTurn"
          @click="choosePrincessFollower(follower.cityId, follower.point)"
        >
          {{ princessChoiceLabel(follower.cityId, follower.point, index) }}
        </UButton>
      </div>
    </section>
  </Draggable>
</template>

<script setup lang="ts">
import type { Point } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { notifyError } from '@/utils/common'

const props = defineProps<{
  gameBoard: IGameBoard
  dragEnabled?: boolean
}>()

function princessChoiceLabel(cityId: string, point: Point, index: number) {
  const follower = props.gameBoard.placedFollowers.find(
    (placed) =>
      placed.objectId === cityId &&
      placed.point.x === point.x &&
      placed.point.y === point.y &&
      placed.point.direction === point.direction
  )
  const player = props.gameBoard.players.find(
    ({ id }) => id === follower?.playerId
  )
  return `Город ${index + 1} — ${player?.name ?? 'подданный'}`
}

function choosePrincessFollower(cityId: string, point: Point) {
  void GameService.choosePrincessFollower(cityId, point).catch((error) => {
    notifyError(error, 'Не удалось выполнить действие принцессы')
  })
}
</script>
