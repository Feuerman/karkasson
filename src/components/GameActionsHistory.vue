<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="10"
    :initial-y="10"
  >
    <div
      class="panel-parchment w-[540px] max-w-[90vw] overflow-hidden shadow-card"
    >
      <div
        class="sticky top-0 z-10 mb-2 flex items-center justify-between gap-3 border-b border-gold-dark/30 bg-surface/90 px-5 py-2.5 backdrop-blur"
      >
        <span class="flex items-center gap-2 text-text">
          <UIcon name="i-lucide-scroll-text" class="h-5 w-5 text-gold-dark" />
          <span class="title-medieval text-[1.05rem] leading-none">
            История действий
          </span>
        </span>
        <span
          class="flex items-center gap-1.5 rounded-full border border-gold-dark/40 bg-gold/15 px-3 py-1 text-sm font-semibold text-gold-dark"
        >
          <UIcon name="i-lucide-layers" class="h-4 w-4" />
          в колоде {{ gameBoard.tilesList.length }}
        </span>
      </div>
      <div class="max-h-[400px] overflow-y-auto px-4 pb-4 pt-1">
        <div v-for="(action, index) in gameBoard.actionsHistory" :key="index">
          <template v-if="action.actionType === ActionTypes.PLACE_TILE">
            <div
              class="mb-1 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-soft"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-gold-dark ring-1 ring-border"
              >
                <UIcon name="i-lucide-layout-grid" class="h-4 w-4" />
              </span>
              <div
                class="flex flex-wrap items-center gap-x-1 text-[0.95rem] leading-snug [&_span+span]:ml-0.5"
              >
                <strong class="mr-[3px] text-text">Выложен тайл.</strong>
                <span :class="playerTextColorClass(action.initiator?.color)">
                  {{ action.initiator?.name }}.
                </span>
                <span class="text-text">
                  Тайл {{ action.actionData.tile.id }} на клетку
                  <span
                    class="cursor-pointer rounded-md bg-primary-soft px-1.5 font-bold text-primary underline-offset-2 transition-opacity hover:opacity-80 active:no-underline"
                    @click="
                      zoomToCoordinates(
                        action.actionData.rowIndex,
                        action.actionData.tileIndex
                      )
                    "
                  >
                    {{ action.actionData.rowIndex }}
                    {{ action.actionData.tileIndex }}</span
                  >
                </span>
              </div>
            </div>
          </template>
          <template
            v-else-if="action.actionType === ActionTypes.PLACE_FOLLOWER"
          >
            <div
              class="mb-1 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-soft"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-gold-dark ring-1 ring-border"
              >
                <UIcon name="i-lucide-person-standing" class="h-4 w-4" />
              </span>
              <div
                class="flex flex-wrap items-center gap-x-1 text-[0.95rem] leading-snug [&_span+span]:ml-0.5"
              >
                <strong class="mr-[3px] text-text">Выставлен подданный.</strong>
                <span :class="playerTextColorClass(action.initiator?.color)">
                  {{ action.initiator?.name }}.
                </span>
                <span class="text-text">
                  На клетку
                  <span
                    class="cursor-pointer rounded-md bg-primary-soft px-1.5 font-bold text-primary underline-offset-2 transition-opacity hover:opacity-80 active:no-underline"
                    @click="
                      zoomToCoordinates(
                        action.actionData.point.y,
                        action.actionData.point.x
                      )
                    "
                  >
                    {{ action.actionData.point.y }}
                    {{ action.actionData.point.x }}</span
                  >
                  на объект {{ action.actionData.point.pointType }}
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.ADDING_SCORES">
            <div
              class="mb-1 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-soft"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-gold-dark ring-1 ring-border"
              >
                <UIcon name="i-lucide-coins" class="h-4 w-4" />
              </span>
              <div
                class="flex flex-wrap items-center gap-x-1 text-[0.95rem] leading-snug [&_span+span]:ml-0.5"
              >
                <strong class="mr-[3px] text-text">Завершён объект.</strong>
                <span @click="highlightObject(action.actionData.objectData)"
                  >{{ action.actionData.objectType }}.
                </span>
                <span class="text-text">Начислено очков:</span>
                <span
                  v-for="(score, playerId) in action.actionData.score.players"
                  :key="playerId"
                >
                  <span
                    :class="
                      playerTextColorClass(
                        gameBoard.players[Number(playerId) - 1]?.color
                      )
                    "
                  >
                    {{ gameBoard.players[Number(playerId) - 1].name }} —
                    {{ score ?? 0 }}
                    {{ pluralForm(score ?? 0, 'очко', 'очка', 'очков') }},
                  </span>
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER">
            <div
              class="mb-1 flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-soft"
            >
              <span
                class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-gold-dark ring-1 ring-border"
              >
                <UIcon name="i-lucide-rotate-ccw" class="h-4 w-4" />
              </span>
              <div
                class="flex flex-wrap items-center gap-x-1 text-[0.95rem] leading-snug [&_span+span]:ml-0.5"
              >
                <strong class="mr-[3px] text-text">Возврат подданных.</strong>
                <span
                  v-for="(count, playerId) in countBy(
                    action.actionData.followers,
                    (follower) => String(follower.playerId)
                  )"
                  :key="playerId"
                >
                  <span
                    :class="
                      playerTextColorClass(
                        gameBoard.players[Number(playerId) - 1]?.color
                      )
                    "
                  >
                    {{ gameBoard.players[Number(playerId) - 1].name }} —
                    {{ count }},&nbsp;
                  </span>
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Draggable>
</template>
<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'
import { ActionTypes } from '@server/modules/types'
import type { BaseObject } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import { playerTextColorClass } from '@/utils/colors'
import { countBy, pluralForm } from '@/utils/common'
import { pulseTile, scrollToTile } from '@/utils/board'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const emits = defineEmits(['highlightObject'])

const highlightObject = (objectData: BaseObject) => {
  emits('highlightObject', objectData)
}

const zoomToCoordinates = (rowIndex: number, tileIndex: number) => {
  scrollToTile(rowIndex, tileIndex)
  pulseTile(rowIndex, tileIndex)
}
</script>
