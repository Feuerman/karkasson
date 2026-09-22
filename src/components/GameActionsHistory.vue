<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="10"
    :initial-y="10"
  >
    <UCard
      class="w-[550px] shadow-strong"
      :ui="{
        root: 'overflow-hidden rounded-lg',
        body: 'p-0',
      }"
    >
      <div
        class="sticky top-0 z-10 mb-2.5 flex justify-between border-b border-border bg-surface px-5 py-2.5 text-[1.4rem] font-medium text-text"
      >
        <span>История действий</span>
        <span class="text-[1.2rem] text-primary"
          >в колоде {{ gameBoard.tilesList.length }}</span
        >
      </div>
      <div class="max-h-[400px] overflow-y-scroll px-5 pb-5 pt-0">
        <div v-for="(action, index) in gameBoard.actionsHistory" :key="index">
          <template v-if="action.actionType === ActionTypes.PLACE_TILE">
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex flex-wrap items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
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
                class="flex flex-wrap items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
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
                class="flex flex-wrap items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
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
                        gameBoard.players[Number(playerId) - 1]?.color
                      )
                    "
                  >
                    {{ gameBoard.players[Number(playerId) - 1].name }} -
                    {{ score ?? 0 }}
                    {{ getPlural(score ?? 0, 'очко', 'очка', 'очков') }},
                  </span>
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER">
            <div class="mb-2 flex items-center gap-2 rounded">
              <div
                class="flex flex-wrap items-center gap-0.5 [&_span+span]:ml-0.5 [&_strong]:mr-[3px]"
              >
                <strong>Возврат подданных.</strong>
                <span
                  v-for="(
                    count, playerId
                  ) in action.actionData.followers.reduce(
                    (acc: Record<string, number>, follower: ObjectFollower) => {
                      const key = String(follower.playerId)
                      if (!acc[key]) {
                        acc[key] = 0
                      }

                      acc[key] += 1
                      return acc
                    },
                    {}
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
                    {{ gameBoard.players[Number(playerId) - 1].name }} -
                    {{ count }},&nbsp;
                  </span>
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </UCard>
  </Draggable>
</template>
<script setup lang="ts">
import UCard from '@nuxt/ui/components/Card.vue'
import { ActionTypes, ObjectTypes } from '@server/modules/types'
import type { BaseObject, ObjectFollower } from '@server/modules/types'
import type { IGameBoard } from '@/types/game'
import Draggable from '@/components/Draggable.vue'
import { playerTextColorClass } from '@/utils/colors'

const props = defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const emits = defineEmits(['highlightObject'])

const highlightObject = (objectData: BaseObject) => {
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

const zoomToCoordinates = (rowIndex: number, tileIndex: number) => {
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
