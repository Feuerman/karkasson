<template>
  <ActionRow icon="i-lucide-sparkles">
    <template v-if="action.actionType === ActionTypes.MOVE_FAIRY">
      <strong class="mr-[3px] text-text">{{ t('action_fairy_moved') }}</strong>
      <span class="text-text">
        <PlayerNameById :player-id="action.actionData.follower.playerId">
          — {{ targetKind(action.actionData.follower) }}
        </PlayerNameById>
        <template v-if="action.actionData.from">
          ({{ t('action_from_cell').toLowerCase() }}
          {{ coordinateLabel(action.actionData.from) }})
        </template>
      </span>
    </template>
    <template v-else>
      <strong class="mr-[3px] text-text">{{ t('action_fairy_point') }}</strong>
      <span class="text-text">
        <PlayerNameById :player-id="action.actionData.follower.playerId">
          {{
            t('action_fairy_receives', {
              points: action.actionData.points,
              unit: pointsUnit(action.actionData.points),
              kind: targetKind(action.actionData.follower),
            })
          }}
        </PlayerNameById>
      </span>
    </template>
  </ActionRow>
</template>

<script setup lang="ts">
import { ActionTypes, TileSideType } from '@server/modules/types'
import type { FairyFollowerRef } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import ActionRow from '../ActionRow.vue'
import PlayerNameById from '../PlayerNameById.vue'
import { plural, t } from '@/utils/i18n'

defineProps<{
  action: Extract<
    GameAction,
    { actionType: ActionTypes.MOVE_FAIRY | ActionTypes.FAIRY_POINT }
  >
}>()

function targetKind(follower: FairyFollowerRef): string {
  if (follower.isAbbot) return t('action_fairy_kind_abbot')
  if (follower.isBigFollower) return t('action_fairy_kind_big')
  if (follower.point.pointType === TileSideType.Field) {
    return t('action_fairy_kind_peasant')
  }
  return t('action_fairy_kind_follower')
}

function pointsUnit(points: number): string {
  return plural(points, {
    one: t('action_points_one'),
    two: t('action_points_two'),
    five: t('action_points_five'),
    other: t('action_points_other'),
  })
}

function coordinateLabel(position: { rowIndex: number; tileIndex: number }) {
  return `${position.tileIndex + 1}, ${position.rowIndex + 1}`
}
</script>
