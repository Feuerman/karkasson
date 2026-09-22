<template>
  <div class="relative overflow-hidden rounded-lg bg-surface shadow-soft">
    <template v-if="props.tile?.imgUrl">
      <img
        :src="tileImg"
        :class="rotateClass"
        class="block transition-transform duration-200 ease-in-out"
        :alt="props.tile?.imgUrl"
        @load="drawTile"
      />
      <canvas
        ref="canvas"
        :width="size"
        :height="size"
        class="pointer-events-none absolute left-0 top-0"
      ></canvas>
    </template>
    <template v-else>
      <div></div>
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

const rotateClasses: Record<number, string> = {
  0: 'rotate-0',
  90: 'rotate-90',
  180: 'rotate-180',
  270: 'rotate-270',
}

const rotateClass = computed(() => {
  const rotation = (((props.tile?.rotation ?? 0) % 360) + 360) % 360
  return rotateClasses[rotation] ?? 'rotate-0'
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
