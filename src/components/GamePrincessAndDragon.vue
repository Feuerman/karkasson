<template>
  <GamePanel
    v-if="gameBoard.dragonMove || gameBoard.princessChoice"
    draggable-id="princess-and-dragon-actions"
    :initial-x="16"
    :initial-y="170"
    :drag-enabled="dragEnabled"
    :collapsed="collapsed"
    :icon="panelIcon"
    :title="panelTitle"
    surface-class="min-w-[240px] max-w-[320px] space-y-2 p-3"
    aria-live="polite"
    @toggle="toggle"
  >
    <div v-if="gameBoard.dragonMove">
      <p class="text-sm text-text-muted">
        {{
          t('dragon_instructions', {
            steps: gameBoard.dragonMove.remainingSteps,
          })
        }}
      </p>
    </div>

    <div v-if="gameBoard.princessChoice" class="space-y-1.5">
      <p class="text-sm text-text-muted">
        {{ t('princess_instructions') }}
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
        {{ princessChoiceLabel(follower.cityId, follower.point) }}
      </UButton>
    </div>
  </GamePanel>
</template>

<script setup lang="ts">
import type { Point } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import GamePanel from '@/components/GamePanel.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import GameService from '@/modules/GameService'
import { notifyError } from '@/utils/common'
import { t } from '@/utils/i18n'
import { usePanelCollapse } from '@/composables/usePanelCollapse'
import { computed } from 'vue'

const props = defineProps<{
  gameBoard: IGameBoard
  dragEnabled?: boolean
}>()

/** Окно можно свернуть, чтобы не закрывать доску. */
const { collapsed, toggle } = usePanelCollapse('princess-and-dragon-actions')

/** Заголовок окна: в партии сначала двигается дракон, потом принцесса. */
const panelTitle = computed(() =>
  props.gameBoard.dragonMove
    ? t('dragon_panel_title')
    : t('princess_panel_title')
)

const panelIcon = computed(() =>
  props.gameBoard.dragonMove ? 'i-lucide-flame' : 'i-lucide-crown'
)

function princessChoiceLabel(cityId: string, point: Point) {
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
  const kind = follower?.isBigFollower
    ? t('princess_kind_big')
    : t('princess_kind')
  return t('princess_label', {
    kind,
    player: player?.name ?? t('princess_unknown_player'),
  })
}

function choosePrincessFollower(cityId: string, point: Point) {
  void GameService.choosePrincessFollower(cityId, point).catch((error) => {
    notifyError(error, t('action_princess_error'))
  })
}
</script>
