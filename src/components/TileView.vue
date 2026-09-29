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
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.08] transition-transform duration-200 ease-in-out"
      ></canvas>
      <div
        v-if="props.tile?.hasGarden"
        class="pointer-events-none absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-1 ring-black/25"
        :title="'Сад'"
      >
        <UIcon name="i-lucide-flower-2" class="h-3.5 w-3.5 text-white" />
      </div>
      <div
        v-if="props.tile?.hasCathedral"
        class="pointer-events-none absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-1 ring-black/25"
        :title="'Собор'"
      >
        <UIcon name="i-lucide-church" class="h-3.5 w-3.5 text-white" />
      </div>
      <div
        v-if="props.tile?.hasInn"
        class="pointer-events-none absolute right-1 bottom-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-1 ring-black/25"
        :title="'Таверна'"
      >
        <UIcon name="i-lucide-beer" class="h-3.5 w-3.5 text-white" />
      </div>
    </template>
    <template v-else>
      <div></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import type { PlacedFollower, Player } from '@server/modules/types'
import { rotationClass } from '@/utils/tiles'
import { getFollowerPosition, isTileId } from '@/utils/followerPositions'
import { playerColorValue } from '@/utils/colors'
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
  players: Array as () => Player[],
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
  'IAC-A': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_A.png',
    import.meta.url
  ),
  'IAC-B': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_B.png',
    import.meta.url
  ),
  'IAC-C': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_C.png',
    import.meta.url
  ),
  'IAC-D': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_D.png',
    import.meta.url
  ),
  'IAC-E': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_E.png',
    import.meta.url
  ),
  'IAC-F': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_F.png',
    import.meta.url
  ),
  'IAC-G': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_G.png',
    import.meta.url
  ),
  'IAC-H': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_H.png',
    import.meta.url
  ),
  'IAC-I': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_I.png',
    import.meta.url
  ),
  'IAC-J': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_J.png',
    import.meta.url
  ),
  'IAC-Ka': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Ka.png',
    import.meta.url
  ),
  'IAC-Kb': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Kb.png',
    import.meta.url
  ),
  'IAC-L': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_L.png',
    import.meta.url
  ),
  'IAC-M': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_M.png',
    import.meta.url
  ),
  'IAC-N': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_N.png',
    import.meta.url
  ),
  'IAC-O': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_O.png',
    import.meta.url
  ),
  'IAC-P': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_P.png',
    import.meta.url
  ),
  'IAC-Q': new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Q.png',
    import.meta.url
  ),
}

const tileImg = computed(() => {
  return imagesMap[props.tile?.id as keyof typeof imagesMap]
})

const rotateClass = computed(() => rotationClass(props.tile?.rotation ?? 0))

const canvas = ref<HTMLCanvasElement | null>(null)

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
        isBigFollower: follower.isBigFollower,
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
    const tileId = String(props.tile?.id ?? '')
    const [normalizedX, normalizedY] = isTileId(tileId)
      ? getFollowerPosition(
          tileId,
          point.direction,
          Number(props.tile?.rotation ?? 0),
          point.pointType ?? tileSideType,
          point.isGarden
        )
      : [0.5, 0.5]
    const x = normalizedX * props.size
    const y = normalizedY * props.size

    const player = props.players?.find(
      ({ id }) => String(id) === String(point.playerId)
    )
    const playerColor = playerColorValue(player?.color)

    // Белый ореол для читаемости на фоне тайла
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(x, y, point.isBigFollower ? 14 : 11, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()

    // Цветное ядро маркера
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(x, y, point.isBigFollower ? 11 : 8.5, 0, Math.PI * 2)
    ctx.fillStyle = playerColor
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.stroke()

    // Аббат отмечается «клерикальным» крестом в ядре маркера
    if (point.isAbbot || point.isBigFollower) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.lineWidth = 2
      const arm = point.isBigFollower ? 5 : 3.2
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
