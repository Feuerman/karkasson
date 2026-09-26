<template>
  <div
    class="relative flex h-full w-full items-center justify-center overflow-hidden"
  >
    <template v-if="props.tile?.imgUrl">
      <img
        :src="tileImg?.href"
        :class="rotateClass"
        class="block h-full w-full scale-[1.08] object-cover transition-transform duration-200 ease-in-out"
        :alt="props.tile?.imgUrl"
        @load="drawTile"
      />
      <canvas
        ref="canvas"
        :width="size"
        :height="size"
        :class="rotateClass"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.08] transition-transform duration-200 ease-in-out"
      ></canvas>
      <div
        v-if="props.tile?.hasGarden"
        class="pointer-events-none absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-1 ring-black/25"
        :title="'Сад'"
      >
        <UIcon name="i-lucide-flower-2" class="h-3.5 w-3.5 text-white" />
      </div>
    </template>
    <template v-else>
      <div></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import type { PlacedFollower } from '@server/modules/types'
import { PlayerColors } from '@server/modules/types'
import { rotationClass } from '@/utils/tiles'
import UIcon from '@nuxt/ui/components/Icon.vue'

const props = defineProps({
  tile: Object,
  rotation: Number,
  highlightPoints: Array,
  size: {
    type: Number,
    default: 110,
  },
  followers: Array as () => PlacedFollower[],
})

const imagesMap = {
  A: new URL('../assets/tiles/Base_Game_C3_Tile_A.png', import.meta.url),
  B: new URL('../assets/tiles/Base_Game_C3_Tile_B.png', import.meta.url),
  C: new URL('../assets/tiles/Base_Game_C3_Tile_C.png', import.meta.url),
  D: new URL('../assets/tiles/Base_Game_C3_Tile_D.png', import.meta.url),
  E: new URL('../assets/tiles/Base_Game_C3_Tile_E.png', import.meta.url),
  F: new URL('../assets/tiles/Base_Game_C3_Tile_F.png', import.meta.url),
  G: new URL('../assets/tiles/Base_Game_C3_Tile_G.png', import.meta.url),
  H: new URL('../assets/tiles/Base_Game_C3_Tile_H.png', import.meta.url),
  I: new URL('../assets/tiles/Base_Game_C3_Tile_I.png', import.meta.url),
  J: new URL('../assets/tiles/Base_Game_C3_Tile_J.png', import.meta.url),
  K: new URL('../assets/tiles/Base_Game_C3_Tile_K.png', import.meta.url),
  L: new URL('../assets/tiles/Base_Game_C3_Tile_L.png', import.meta.url),
  M: new URL('../assets/tiles/Base_Game_C3_Tile_M.png', import.meta.url),
  N: new URL('../assets/tiles/Base_Game_C3_Tile_N.png', import.meta.url),
  O: new URL('../assets/tiles/Base_Game_C3_Tile_O.png', import.meta.url),
  P: new URL('../assets/tiles/Base_Game_C3_Tile_P.png', import.meta.url),
  Q: new URL('../assets/tiles/Base_Game_C3_Tile_Q.png', import.meta.url),
  R: new URL('../assets/tiles/Base_Game_C3_Tile_R.png', import.meta.url),
  S: new URL('../assets/tiles/Base_Game_C3_Tile_S.png', import.meta.url),
  T: new URL('../assets/tiles/Base_Game_C3_Tile_T.png', import.meta.url),
  U: new URL('../assets/tiles/Base_Game_C3_Tile_U.png', import.meta.url),
  V: new URL('../assets/tiles/Base_Game_C3_Tile_V.png', import.meta.url),
  W: new URL('../assets/tiles/Base_Game_C3_Tile_W.png', import.meta.url),
  X: new URL('../assets/tiles/Base_Game_C3_Tile_X.png', import.meta.url),
}

const tileImg = computed(() => {
  return imagesMap[props.tile?.id as keyof typeof imagesMap]
})

const rotateClass = computed(() => rotationClass(props.tile?.rotation ?? 0))

const canvas = ref<HTMLCanvasElement | null>(null)

const sideDirections = ['north', 'east', 'south', 'west'] as const
type SideDirection = (typeof sideDirections)[number]

const roadPositions: Record<
  string,
  Partial<Record<SideDirection, [number, number]>>
> = {
  A: { south: [0.62, 0.72] },
  D: { east: [0.75, 0.64], west: [0.25, 0.64] },
  J: { east: [0.77, 0.6], south: [0.6, 0.78] },
  K: { south: [0.5, 0.78], west: [0.23, 0.53] },
  L: { east: [0.78, 0.55], south: [0.5, 0.78], west: [0.22, 0.55] },
  O: { east: [0.76, 0.55], south: [0.55, 0.76] },
  P: { east: [0.76, 0.55], south: [0.55, 0.76] },
  S: { south: [0.5, 0.76] },
  T: { south: [0.5, 0.76] },
  U: { north: [0.5, 0.57], south: [0.5, 0.57] },
  V: { south: [0.56, 0.78], west: [0.2, 0.52] },
  W: { east: [0.78, 0.5], south: [0.5, 0.78], west: [0.22, 0.5] },
  X: {
    north: [0.5, 0.22],
    east: [0.78, 0.5],
    south: [0.5, 0.78],
    west: [0.22, 0.5],
  },
}

const cityPositions: Record<
  string,
  Partial<Record<SideDirection, [number, number]>>
> = {
  C: {
    north: [0.5, 0.35],
    east: [0.65, 0.5],
    south: [0.5, 0.65],
    west: [0.35, 0.5],
  },
  D: { north: [0.5, 0.3] },
  E: { north: [0.5, 0.3] },
  F: { east: [0.73, 0.48], west: [0.27, 0.52] },
  G: { east: [0.73, 0.48], west: [0.27, 0.52] },
  H: { north: [0.5, 0.3], south: [0.5, 0.7] },
  I: { north: [0.7, 0.3], west: [0.3, 0.7] },
  J: { north: [0.5, 0.3] },
  K: { north: [0.5, 0.3] },
  L: { north: [0.5, 0.3] },
  M: { north: [0.7, 0.3], east: [0.7, 0.3] },
  N: { north: [0.7, 0.3], east: [0.7, 0.3] },
  O: { north: [0.3, 0.3], west: [0.3, 0.3] },
  P: { north: [0.3, 0.3], west: [0.3, 0.3] },
  Q: {
    north: [0.5, 0.31],
    east: [0.69, 0.5],
    west: [0.31, 0.5],
  },
  R: {
    north: [0.5, 0.31],
    east: [0.69, 0.5],
    west: [0.31, 0.5],
  },
  S: {
    north: [0.5, 0.28],
    east: [0.74, 0.5],
    west: [0.26, 0.5],
  },
  T: {
    north: [0.5, 0.28],
    east: [0.74, 0.5],
    west: [0.26, 0.5],
  },
}

const gardenPositions: Record<string, [number, number]> = {
  E: [0.5, 0.78],
  H: [0.5, 0.5],
  I: [0.74, 0.74],
  M: [0.26, 0.74],
  N: [0.26, 0.74],
  R: [0.5, 0.78],
  U: [0.74, 0.5],
  V: [0.74, 0.3],
}

const getCanonicalDirection = (
  direction: SideDirection,
  rotation: number
): SideDirection => {
  const directionIndex = sideDirections.indexOf(direction)
  const rotationSteps = Math.round(rotation / 90)
  const baseIndex = (directionIndex - rotationSteps + 4) % 4
  return sideDirections[baseIndex]
}

const getFollowerPosition = (
  point: PlacedFollower['point'],
  tileId: string,
  rotation: number,
  isGarden: boolean | undefined,
  pointType: PlacedFollower['point']['pointType']
): [number, number] => {
  const center = props.size / 2
  if (point.direction === 'center') {
    if (!isGarden) return [center, center]
    const [x, y] = gardenPositions[tileId] ?? [0.5, 0.5]
    return [x * props.size, y * props.size]
  }

  if (!sideDirections.includes(point.direction as SideDirection)) {
    return [center, center]
  }

  const featureDirection = getCanonicalDirection(
    point.direction as SideDirection,
    rotation
  )

  if (pointType === 'road') {
    const [x, y] = roadPositions[tileId]?.[featureDirection] ?? [0.5, 0.5]
    return [x * props.size, y * props.size]
  }

  if (pointType === 'city') {
    const position = cityPositions[tileId]?.[featureDirection]
    if (position) return [position[0] * props.size, position[1] * props.size]
  }

  const radius = props.size * (pointType === 'city' ? 0.32 : 0.25)
  switch (featureDirection) {
    case 'north':
      return [center, center - radius]
    case 'east':
      return [center + radius, center]
    case 'south':
      return [center, center + radius]
    case 'west':
      return [center - radius, center]
  }
}

const drawTile = () => {
  if (!canvas.value || !props.followers) return

  const ctx = canvas.value.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Настройки стиля для точек
  ctx.lineWidth = 2

  const highlightPoints = props.followers
    .map((follower) => {
      return {
        ...follower.point,
        playerId: follower.playerId,
        isAbbot: follower.isAbbot,
        isGarden: follower.isGarden,
      }
    })
    .filter(
      (point) =>
        point.x === props.tile?.tileIndex && point.y === props.tile?.rowIndex
    )

  // Рисуем каждую точку с учетом направления
  highlightPoints.forEach((point) => {
    const tileSideType =
      point.direction && point.direction !== 'center' && props.tile?.sides
        ? props.tile.sides[point.direction]
        : undefined
    const [x, y] = getFollowerPosition(
      point,
      String(props.tile?.id ?? ''),
      Number(props.tile?.rotation ?? 0),
      point.isGarden,
      point.pointType ?? tileSideType
    )

    const playerColor = String(
      PlayerColors[point.playerId as keyof typeof PlayerColors]
    )

    // Белый ореол для читаемости на фоне тайла
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()

    // Цветное ядро маркера
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(x, y, 8.5, 0, Math.PI * 2)
    ctx.fillStyle = playerColor
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.stroke()

    // Аббат отмечается «клерикальным» крестом в ядре маркера
    if (point.isAbbot) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 2
      const arm = 3.2
      ctx.beginPath()
      ctx.moveTo(x - arm, y)
      ctx.lineTo(x + arm, y)
      ctx.moveTo(x, y - arm)
      ctx.lineTo(x, y + arm)
      ctx.stroke()
    }

    ctx.restore()
  })
}

watch(
  () => props.followers,
  () => {
    nextTick(() => {
      drawTile()
    })
  },
  { deep: true }
)

watch(
  () => props.tile,
  () => {
    nextTick(() => {
      drawTile()
    })
  },
  { deep: true }
)
</script>
