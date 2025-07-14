<template>
  <Draggable
    v-if="gameBoard.isPlacingFollower"
    draggable-id="placing-followers"
    class="game-placing-followers"
    :initial-x="700"
    :initial-y="400"
  >
    <template v-if="gameBoard.availableFollowersPlaces.length === 0">
      <div>Нет доступных клеток</div>
      <button @click="gameBoard.isMyTurn && GameService.skipFollower">
        Отменить
      </button>
    </template>
    <template v-else>
      <div
        v-for="(place, index) in gameBoard.availableFollowersPlaces"
        :key="index"
        @click.stop="gameBoard.isMyTurn && GameService.placeFollower(place)"
      >
        <template v-if="place.temporaryObject?.isMonastery">Монастырь</template>
        <template v-else>
          {{ pointTypeTitle(place.point.pointType) }}
          {{ pointDirectionTitle(place.point.direction) }}
        </template>
      </div>
    </template>
  </Draggable>
</template>

<script setup lang="ts">
import { type IGameBoard } from '../../server/src/modules/GameManager.ts'
import Draggable from '@/components/Draggable.vue'
import GameService from '@/modules/GameService.js'

defineProps({
  gameBoard: {
    type: Object as () => IGameBoard,
    required: true,
  },
})

const pointTypeTitle = (pointType: any) => {
  const pointTypeMap = {
    city: 'Город',
    road: 'Дорога',
    field: 'Поле',
    monastery: 'Монастырь',
  }

  return pointTypeMap[pointType]
}

const pointDirectionTitle = (direction: any) => {
  const directionMap = {
    north: 'Север',
    south: 'Юг',
    east: 'Восток',
    west: 'Запад',
  }

  return directionMap[direction]
}
</script>

<style lang="scss" scoped>
.game-placing-followers {
  background-color: #fff;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 200px;

  &__title {
    font-size: 1.2rem;
    color: #333;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  &__followers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  &__follower {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;

    &:hover {
      background-color: #f5f5f5;
    }

    &--selected {
      border-color: #2196f3;
      background-color: #e3f2fd;
    }

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background-color: #f5f5f5;
    }
  }

  &__follower-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    font-size: 1.5rem;

    &--knight {
      background-color: #f44336;
      color: white;
    }

    &--farmer {
      background-color: #4caf50;
      color: white;
    }

    &--monk {
      background-color: #9c27b0;
      color: white;
    }

    &--robber {
      background-color: #ff9800;
      color: white;
    }
  }

  &__follower-name {
    font-size: 0.9rem;
    color: #333;
    text-align: center;
  }

  &__follower-count {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.25rem;
  }

  &__actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  &__button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &--primary {
      background-color: #2196f3;
      color: white;

      &:hover {
        background-color: #1976d2;
      }

      &:disabled {
        background-color: #bdbdbd;
        cursor: not-allowed;
      }
    }

    &--secondary {
      background-color: #f5f5f5;
      color: #333;

      &:hover {
        background-color: #e0e0e0;
      }
    }
  }
}
</style>
