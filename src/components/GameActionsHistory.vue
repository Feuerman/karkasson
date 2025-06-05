<template>
  <Draggable
    v-if="gameBoard.gameIsStarted"
    draggable-id="game-controls"
    :initial-x="10"
    :initial-y="10"
  >
    <div class="game-actions-history">
      <div class="game-actions-history__title">
        <span>История действий</span>
        <span class="game-actions-history__title-count"
          >в колоде {{ gameBoard.tilesList.length }}</span
        >
      </div>
      <div class="game-actions-history__list">
        <div v-for="(action, index) in gameBoard.actionsHistory" :key="index">
          <template v-if="action.actionType === ActionTypes.PLACE_TILE">
            <div class="game-actions-history__item">
              <div class="game-actions-history__item-title">
                <strong>Выложен тайл. </strong>
                <span
                  :style="{
                    color: action.initiator?.color,
                  }"
                >
                  {{ action.initiator?.name }}.
                </span>
                <span
                  >Тайл {{ action.actionData.tile.id }} на клетку
                  <span
                    class="link-style"
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
            <div class="game-actions-history__item">
              <div class="game-actions-history__item-title">
                <strong>Выcтавлен подданный. </strong>
                <span
                  :style="{
                    color: action.initiator?.color,
                  }"
                >
                  {{ action.initiator.name }}.
                </span>
                <span
                  >На клетку
                  <span
                    class="link-style"
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
            <div class="game-actions-history__item">
              <div class="game-actions-history__item-title">
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
                    :style="{ color: gameBoard.players[playerId - 1].color }"
                  >
                    {{ gameBoard.players[playerId - 1].name }} - {{ score }}
                    {{ getPlural(score, 'очко', 'очка', 'очков') }},
                  </span>
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="action.actionType === ActionTypes.BACK_FOLLOWER">
            <div class="game-actions-history__item">
              <div class="game-actions-history__item-title">
                <strong>Возврат подданных. </strong>
                <span
                  v-for="(
                    count, playerId
                  ) in action.actionData.followers.reduce((acc, follower) => {
                    if (!acc[follower.playerId]) acc[follower.playerId] = 0
                    acc[follower.playerId] += 1
                    return acc
                  }, {})"
                  :key="playerId"
                >
                  <span
                    :style="{ color: gameBoard.players[playerId - 1].color }"
                  >
                    {{ gameBoard.players[playerId - 1].name }} - {{ count }}
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
import { defineEmits, defineProps } from 'vue'
import Draggable from '@/components/Draggable.vue'

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
    '.game-tile[data-row-index="' +
      rowIndex +
      '"][data-tile-index="' +
      tileIndex +
      '"]'
  )

  if (targetTile) {
    targetTile?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    })

    targetTile.classList.add('--active')

    setTimeout(() => {
      targetTile.classList.remove('--active')
    }, 1000)
  }
}
</script>

<style scoped lang="scss">
.game-actions-history {
  width: 550px;
  padding: 0 20px 20px 20px;
  background-color: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  &__title {
    position: sticky;
    top: 0;
    padding: 10px 0;
    background-color: #fff;
    border-bottom: 1px solid #e0e0e0;
    font-size: 1.4rem;
    color: #333;
    margin-bottom: 10px;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
  }

  &__title-count {
    font-size: 1.2rem;
    color: #2196f3;
  }

  &__list {
    overflow-y: scroll;
    max-height: 400px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  &__icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
  }

  &__text {
    font-size: 0.9rem;
    color: #333;
    font-weight: 500;
  }
}
</style>
