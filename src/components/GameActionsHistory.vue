<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="10"
    :initial-y="10"
  >
    <div
      class="w-[550px] overflow-hidden rounded-lg bg-surface px-5 pb-5 shadow-strong"
    >
      <div
        class="sticky top-0 z-10 mb-2.5 flex justify-between border-b border-border bg-surface px-0 py-2.5 text-[1.4rem] font-medium text-text"
      >
        <span>История действий</span>
        <span class="text-[1.2rem] text-primary"
          >в колоде {{ gameBoard.tilesList.length }}</span
        >
      </div>
      <div class="max-h-[400px] overflow-y-scroll">
        <div v-for="(action, index) in gameBoard.actionsHistory" :key="index">
          <template v-if="action.actionType === ActionTypes.PLACE_TILE">
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
              >
                <strong>Выложен тайл. </strong>
                <span :class="playerTextColorClass(action.initiator?.color)">
                  {{ action.initiator?.name }}.
                </span>
                <span
                  >Тайл {{ action.actionData.tile.id }} на клетку
                  <span
                    class="cursor-pointer font-semibold underline transition-opacity hover:opacity-80 active:no-underline"
                    @click="
                      zoomToCoordinates(
                        action.actionData.rowIndex,
                        action.actionData.tileIndex
                      )
                    "
                    >{{ action.actionData.rowIndex }}
                    {{ action.actionData.tileIndex }}</span
                  ></span
                >
              </div>
            </div>
          </template>
          <template
            v-else-if="action.actionType === ActionTypes.PLACE_FOLLOWER"
          >
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
              >
                <strong>Выcтавлен подданный. </strong>
                <span :class="playerTextColorClass(action.initiator?.color)">
                  {{ action.initiator?.name }}.
                </span>
                <span
                  >На клетку
                  <span
                    class="cursor-pointer font-semibold underline transition-opacity hover:opacity-80 active:no-underline"
                    @click="
                      zoomToCoordinates(
                        action.actionData.point.y,
                        action.actionData.point.x
                      )
                    "
                    >{{ action.actionData.point.y }}
                    {{ action.actionData.point.x }}</span
                  >
                </span>
                на объект {{ action.actionData.point.pointType }}
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.ADDING_SCORES">
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
              >
                <strong>Завершен объект. </strong>
                <span @click="highlightObject(action.actionData.objectData)"
                  >{{ action.actionData.objectType }}.
                </span>
                <span>Начислено очков: </span>
                <span
                  v-for="(score, playerId) in action.actionData.score.players"
                  :key="playerId"
                >
                  <span
                    :class="
                      playerTextColorClass(
                        gameBoard.players[playerId - 1]?.color
                      )
                    "
                  >
                    {{ gameBoard.players[playerId - 1].name }} - {{ score }}
                    {{ getPlural(score, 'очко', 'очка', 'очков') }},
                  </span>
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER">
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
              >
                <strong>Возврат подданных.</strong>
                <span
                  v-for="(
                    count, playerId
                  ) in action.actionData.followers.reduce((acc, follower) => {
                    if (!acc[follower.playerId]) {
                      acc[follower.playerId] = 0
                    }

                    acc[follower.playerId] += 1
                    return acc
                  }, {})"
                  :key="playerId"
                >
                  <span
                    :class="
                      playerTextColorClass(
                        gameBoard.players[playerId - 1]?.color
                      )
                    "
                  >
                    {{ gameBoard.players[playerId - 1].name }} -
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
import {
  ActionTypes,
  type IGameBoard,
  ObjectTypes,
} from '../../server/src/modules/GameManager.ts'
import { defineEmits } from 'vue'
import Draggable from '@/components/Draggable.vue'
import { playerTextColorClass } from '@/utils/colors'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const emits = defineEmits(['highlightObject'])

const highlightObject = (objectData) => {
  emits('highlightObject', objectData)
}

const getPlural = (count: number, one: string, two: string, five: string) => {
  return count % 10 === 1 && count % 100 !== 11
    ? one
    : count % 10 >= 2 &&
        count % 10 <= 4 &&
        (count % 100 < 10 || count % 100 >= 20)
      ? two
      : five
}

const zoomToCoordinates = (rowIndex, tileIndex) => {
  const targetTile = document.querySelector(
    '[data-row-index="' + rowIndex + '"][data-tile-index="' + tileIndex + '"]'
  )

  if (targetTile) {
    targetTile?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })

    targetTile.classList.add('tile-pulse')

    setTimeout(() => {
      targetTile.classList.remove('tile-pulse')
    }, 1000)
  }
}
</script>
