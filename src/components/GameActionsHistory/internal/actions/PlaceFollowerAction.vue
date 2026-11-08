<template>
  <ActionRow icon="i-lucide-person-standing">
    <strong class="mr-[3px] text-text" :title="followerTitle">
      {{ t('action_placed_follower_prefix') }}
      {{ followerName }}.
    </strong>
    <PlayerName :color="action.initiator?.color">
      {{ action.initiator?.name }}.
    </PlayerName>
    <span class="text-text">
      {{ t('action_on_cell') }}
      <ActionCoordinates
        :row="action.actionData.point.y"
        :col="action.actionData.point.x"
        @zoom="forwardZoom"
      />
      {{ t('action_on_object') }}
      <button
        type="button"
        class="cursor-pointer font-bold text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary-dark hover:decoration-primary"
        :data-testid="TEST_IDS.historyObjectFocus"
        :title="t('action_show_object')"
        @click="emit('focus', [followerCell])"
      >
        {{ objectName }}
      </button>
    </span>
  </ActionRow>
</template>

<script setup lang="ts">
import { FollowerType, ObjectTypes } from '@server/modules/types'
import { computed } from 'vue'
import { ActionTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import type { TileCoordinates } from '@/utils/board'
import { cellOfPoint } from '@/utils/board'
import { TEST_IDS } from '@/data/testIds'
import ActionRow from '../ActionRow.vue'
import ActionCoordinates from '../ActionCoordinates.vue'
import PlayerName from '../PlayerName.vue'
import {
  bigFollowerHint as bigFollowerHintText,
  placedFollowerName,
} from '../followerNames'
import { OBJECT_TYPE_GENITIVES, POINT_TYPE_OBJECT_CASE } from '@/utils/labels'
import { t } from '@/utils/i18n'

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
    ? OBJECT_TYPE_GENITIVES[ObjectTypes.MONASTERY]
    : action.actionData.temporaryObject?.isGarden
      ? OBJECT_TYPE_GENITIVES[ObjectTypes.GARDEN]
      : action.actionData.point.pointType
        ? POINT_TYPE_OBJECT_CASE[action.actionData.point.pointType]
        : t('action_object_generic')
)

const followerName = computed(() => placedFollowerName(action.actionData))

const followerTitle = computed(() =>
  action.actionData.followerType === FollowerType.BigFollower
    ? bigFollowerHintText()
    : undefined
)

const forwardZoom = (row: number, col: number) => {
  emit('zoom', row, col)
}
</script>
