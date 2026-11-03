<template>
  <ActionRow icon="i-lucide-sparkles">
    <template v-if="action.actionType === ActionTypes.MOVE_FAIRY">
      <strong class="mr-[3px] text-text">Фея переместилась.</strong>
      <span class="text-text">
        <PlayerNameById :player-id="action.actionData.follower.playerId">
          — {{ targetKind(action.actionData.follower) }}
        </PlayerNameById>
        <template v-if="action.actionData.from">
          (с клетки {{ coordinateLabel(action.actionData.from) }})
        </template>
      </span>
    </template>
    <template v-else>
      <strong class="mr-[3px] text-text">Очко феи.</strong>
      <span class="text-text">
        <PlayerNameById :player-id="action.actionData.follower.playerId">
          получает {{ action.actionData.points }} очко за
          {{ targetKind(action.actionData.follower) }}.
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

defineProps<{
  action: Extract<
    GameAction,
    { actionType: ActionTypes.MOVE_FAIRY | ActionTypes.FAIRY_POINT }
  >
}>()

function targetKind(follower: FairyFollowerRef): string {
  if (follower.isAbbot) return 'аббата'
  if (follower.isBigFollower) return 'большого подданного'
  if (follower.point.pointType === TileSideType.Field) return 'крестьянина'
  return 'подданного'
}

function coordinateLabel(position: { rowIndex: number; tileIndex: number }) {
  return `${position.tileIndex + 1}, ${position.rowIndex + 1}`
}
</script>
