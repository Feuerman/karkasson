<template>
  <ActionRow icon="i-lucide-person-standing">
    <strong class="mr-[3px] text-text" :title="followerTitle">
      Выставлен
      {{ followerName }}.
    </strong>
    <PlayerName :color="action.initiator?.color">
      {{ action.initiator?.name }}.
    </PlayerName>
    <span class="text-text">
      На клетку
      <ActionCoordinates
        :row="action.actionData.point.y"
        :col="action.actionData.point.x"
        @zoom="forwardZoom"
      />
      на объект
      <button
        type="button"
        class="cursor-pointer font-bold text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary-dark hover:decoration-primary"
        :data-testid="TEST_IDS.historyObjectFocus"
        title="Показать объект на доске"
        @click="emit('focus', [followerCell])"
      >
        {{ objectName }}
      </button>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { FollowerType, TileSideType } from '@server/modules/types'
import { computed } from 'vue'
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/GameManager'
import type { TileCoordinates } from '@/utils/board'
import { cellOfPoint } from '@/utils/board'
import { TEST_IDS } from '@/data/testIds'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'
import { BIG_FOLLOWER_HINT, placedFollowerName } from '../followerNames'

const { action } = defineProps<{
  action: Extract<GameAction, { actionType: ActionTypes.PLACE_FOLLOWER }>
}>()

const emit = defineEmits<{
  zoom: [row: number, col: number]
  focus: [cells: TileCoordinates[]]
}>()

const followerCell = computed(() => cellOfPoint(action.actionData.point))

const objectName = computed(() =>
  action.actionData.temporaryObject?.isMonastery
    ? 'монастырь'
    : action.actionData.temporaryObject?.isGarden
      ? 'сад'
      : action.actionData.point.pointType
        ? POINT_TYPE_OBJECT_CASE[action.actionData.point.pointType]
        : 'объект'
)

const POINT_TYPE_OBJECT_CASE: Record<TileSideType, string> = {
  [TileSideType.Field]: 'поле',
  [TileSideType.Road]: 'дорогу',
  [TileSideType.City]: 'город',
}

const followerName = computed(() => placedFollowerName(action.actionData))

const followerTitle = computed(() =>
  action.actionData.followerType === FollowerType.BigFollower
    ? BIG_FOLLOWER_HINT
    : undefined
)

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
