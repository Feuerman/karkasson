<template>
  <div class="tile">
    <template v-if="props.tile?.imgUrl">
      <img
        :src="tileImg"
        :style="imageStyle"
        :alt="props.tile?.imgUrl"
        @load="drawTile"
      />
      <canvas
        ref="canvas"
        :width="size"
        :height="size"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }"
      ></canvas>
    </template>
    <template v-else>
      <div class="tile__empty"></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { PlayerColors } from '../../server/src/modules/types.ts'

const props = defineProps({
  tile: Object,
  rotation: Number,
  highlightPoints: Array,
  size: {
    type: Number,
    default: 110,
  },
  followers: Array,
})

const imagesMap = {
  A: new URL('../assets/tiles/Base_Game_C3_Tile_A.png', import.meta.url),
  B: new URL('../assets/tiles/Base_Game_C3_Tile_B.png', import.meta.url),
  C: new URL('../assets/tiles/Base_Game_C3_Tile_L.png', import.meta.url),
  D: new URL('../assets/tiles/Base_Game_C3_Tile_C.png', import.meta.url),
  E: new URL('../assets/tiles/Base_Game_C3_Tile_D.png', import.meta.url),
  F: new URL('../assets/tiles/Base_Game_C3_Tile_E.png', import.meta.url),
  G: new URL('../assets/tiles/Base_Game_C3_Tile_F.png', import.meta.url),
  H: new URL('../assets/tiles/Base_Game_C3_Tile_G.png', import.meta.url),
  I: new URL('../assets/tiles/Base_Game_C3_Tile_H.png', import.meta.url),
  J: new URL('../assets/tiles/Base_Game_C3_Tile_I.png', import.meta.url),
  K: new URL('../assets/tiles/Base_Game_C3_Tile_J.png', import.meta.url),
  L: new URL('../assets/tiles/Base_Game_C3_Tile_K.png', import.meta.url),
  M: new URL('../assets/tiles/Base_Game_C3_Tile_O.png', import.meta.url),
  N: new URL('../assets/tiles/Base_Game_C3_Tile_P.png', import.meta.url),
  O: new URL('../assets/tiles/Base_Game_C3_Tile_Q.png', import.meta.url),
  P: new URL('../assets/tiles/Base_Game_C3_Tile_R.png', import.meta.url),
  Q: new URL('../assets/tiles/Base_Game_C3_Tile_S.png', import.meta.url),
  R: new URL('../assets/tiles/Base_Game_C3_Tile_T.png', import.meta.url),
  S: new URL('../assets/tiles/Base_Game_C3_Tile_U.png', import.meta.url),
  T: new URL('../assets/tiles/Base_Game_C3_Tile_V.png', import.meta.url),
  U: new URL('../assets/tiles/Base_Game_C3_Tile_W.png', import.meta.url),
  V: new URL('../assets/tiles/Base_Game_C3_Tile_X.png', import.meta.url),
}

const tileImg = computed(() => {
  return imagesMap[props.tile?.id]
})

const imageStyle = computed(() => {
  return {
    transform: 'rotate(' + props.tile?.rotation + 'deg)',
    transition: 'transform 0.2s ease-in-out',
  }
})

const canvas = ref(null)

const drawTile = () => {
  if (!canvas.value || !props.followers) return

  const ctx = canvas.value.getContext('2d')
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Настройки стиля для точек
  ctx.lineWidth = 2

  const highlightPoints = props.followers
    .map((follower) => {
      return {
        ...follower.point,
        playerId: follower.playerId,
      }
    })
    .filter(
      (point) =>
        point.x === props.tile?.tileIndex && point.y === props.tile?.rowIndex
    )

  // Рисуем каждую точку с учетом направления
  highlightPoints.forEach((point) => {
    let x, y
    const center = props.size / 2
    const offset = 20 // Отступ от края тайла

    // Определяем координаты точки в зависимости от направления
    switch (point.direction) {
      case 'north':
        x = center
        y = offset
        break
      case 'east':
        x = props.size - offset
        y = center
        break
      case 'south':
        x = center
        y = props.size - offset
        break
      case 'west':
        x = offset
        y = center
        break
      default:
        // Если direction не указан, используем координаты из point.x и point.y
        x = point.x
        y = point.y
    }

    ctx.fillStyle = PlayerColors[point.playerId]
    ctx.strokeStyle = PlayerColors[point.playerId]

    // Рисуем круг (точку)
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.fill()

    // Опционально: добавляем обводку для лучшей видимости
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.stroke()
  })
}

watch(
  () => props.followers,
  (value) => {
    nextTick(() => {
      drawTile()
    })
  },
  { deep: true }
)

watch(
  () => props.tile,
  (value) => {
    nextTick(() => {
      drawTile()
    })
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
.tile-view {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__follower {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -50%);

    &--knight {
      background-color: #f44336;
    }

    &--farmer {
      background-color: #4caf50;
    }

    &--monk {
      background-color: #9c27b0;
    }

    &--robber {
      background-color: #ff9800;
    }

    &--north {
      top: 25%;
      left: 50%;
    }

    &--south {
      top: 75%;
      left: 50%;
    }

    &--east {
      top: 50%;
      left: 75%;
    }

    &--west {
      top: 50%;
      left: 25%;
    }

    &--center {
      top: 50%;
      left: 50%;
    }
  }

  &__overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
    }
  }

  &__rotation-indicator {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: #333;
  }
}
</style>
