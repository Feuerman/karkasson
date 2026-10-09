<template>
  <div
    class="relative flex h-full w-full items-center justify-center overflow-hidden"
  >
    <template v-if="props.tile?.imgUrl">
      <img
        :src="tileImg"
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
    </template>
    <template v-else>
      <div></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import {
  PointDirection,
  SideName,
  TileId,
  type PlacedFollower,
  type Player,
} from '@server/modules/types'
import { rotationClass } from '@/utils/tiles'
import { getFollowerPosition, isTileId } from '@/utils/followerPositions'
import { playerColorValue } from '@/utils/colors'

const props = defineProps({
  tile: Object,
  rotation: Number,
  size: {
    type: Number,
    default: 110,
  },
  followers: Array as () => PlacedFollower[],
  players: Array as () => Player[],
})

const imagesMap = {
  [TileId.A]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_A.png',
    import.meta.url
  ),
  [TileId.B]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_B.png',
    import.meta.url
  ),
  [TileId.C]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_C.png',
    import.meta.url
  ),
  [TileId.D]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_D.png',
    import.meta.url
  ),
  [TileId.E]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_E.png',
    import.meta.url
  ),
  [TileId.F]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_F.png',
    import.meta.url
  ),
  [TileId.G]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_G.png',
    import.meta.url
  ),
  [TileId.H]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_H.png',
    import.meta.url
  ),
  [TileId.I]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_I.png',
    import.meta.url
  ),
  [TileId.J]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_J.png',
    import.meta.url
  ),
  [TileId.K]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_K.png',
    import.meta.url
  ),
  [TileId.L]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_L.png',
    import.meta.url
  ),
  [TileId.M]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_M.png',
    import.meta.url
  ),
  [TileId.N]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_N.png',
    import.meta.url
  ),
  [TileId.O]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_O.png',
    import.meta.url
  ),
  [TileId.P]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_P.png',
    import.meta.url
  ),
  [TileId.Q]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_Q.png',
    import.meta.url
  ),
  [TileId.R]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_R.png',
    import.meta.url
  ),
  [TileId.S]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_S.png',
    import.meta.url
  ),
  [TileId.T]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_T.png',
    import.meta.url
  ),
  [TileId.U]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_U.png',
    import.meta.url
  ),
  [TileId.V]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_V.png',
    import.meta.url
  ),
  [TileId.W]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_W.png',
    import.meta.url
  ),
  [TileId.X]: new URL(
    '../assets/tiles/Base_Game_C3_Tile_X.png',
    import.meta.url
  ),
  [TileId.IAC_A]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_A.png',
    import.meta.url
  ),
  [TileId.IAC_B]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_B.png',
    import.meta.url
  ),
  [TileId.IAC_C]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_C.png',
    import.meta.url
  ),
  [TileId.IAC_D]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_D.png',
    import.meta.url
  ),
  [TileId.IAC_E]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_E.png',
    import.meta.url
  ),
  [TileId.IAC_F]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_F.png',
    import.meta.url
  ),
  [TileId.IAC_G]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_G.png',
    import.meta.url
  ),
  [TileId.IAC_H]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_H.png',
    import.meta.url
  ),
  [TileId.IAC_I]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_I.png',
    import.meta.url
  ),
  [TileId.IAC_J]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_J.png',
    import.meta.url
  ),
  [TileId.IAC_Ka]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Ka.png',
    import.meta.url
  ),
  [TileId.IAC_Kb]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Kb.png',
    import.meta.url
  ),
  [TileId.IAC_L]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_L.png',
    import.meta.url
  ),
  [TileId.IAC_M]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_M.png',
    import.meta.url
  ),
  [TileId.IAC_N]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_N.png',
    import.meta.url
  ),
  [TileId.IAC_O]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_O.png',
    import.meta.url
  ),
  [TileId.IAC_P]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_P.png',
    import.meta.url
  ),
  [TileId.IAC_Q]: new URL(
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Q.png',
    import.meta.url
  ),
  [TileId.RIVER_A]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_A.png',
    import.meta.url
  ),
  [TileId.RIVER_B]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_B.png',
    import.meta.url
  ),
  [TileId.RIVER_C]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_C.png',
    import.meta.url
  ),
  [TileId.RIVER_D]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_D.png',
    import.meta.url
  ),
  [TileId.RIVER_F]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_F.png',
    import.meta.url
  ),
  [TileId.RIVER_G]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_G.png',
    import.meta.url
  ),
  [TileId.RIVER_H]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_H.png',
    import.meta.url
  ),
  [TileId.RIVER_I]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_I.png',
    import.meta.url
  ),
  [TileId.RIVER_J]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_J.png',
    import.meta.url
  ),
  [TileId.RIVER_K]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_K.png',
    import.meta.url
  ),
  [TileId.RIVER_L]: new URL(
    '../assets/tiles/river/River_I_C3_Tile_L.png',
    import.meta.url
  ),
  [TileId.PAD_A]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_A.jpg',
    import.meta.url
  ),
  [TileId.PAD_B]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_B.jpg',
    import.meta.url
  ),
  [TileId.PAD_C]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_C.jpg',
    import.meta.url
  ),
  [TileId.PAD_D]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_D.jpg',
    import.meta.url
  ),
  [TileId.PAD_E]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_E.jpg',
    import.meta.url
  ),
  [TileId.PAD_F]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_F.jpg',
    import.meta.url
  ),
  [TileId.PAD_G]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_G.jpg',
    import.meta.url
  ),
  [TileId.PAD_H]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_H.jpg',
    import.meta.url
  ),
  [TileId.PAD_I]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_I.jpg',
    import.meta.url
  ),
  [TileId.PAD_J]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_J.jpg',
    import.meta.url
  ),
  [TileId.PAD_K]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_K.jpg',
    import.meta.url
  ),
  [TileId.PAD_L]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_L.jpg',
    import.meta.url
  ),
  [TileId.PAD_M]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_M.jpg',
    import.meta.url
  ),
  [TileId.PAD_N]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_N.jpg',
    import.meta.url
  ),
  [TileId.PAD_O]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_O.jpg',
    import.meta.url
  ),
  [TileId.PAD_P]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_P.jpg',
    import.meta.url
  ),
  [TileId.PAD_Q]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Q.jpg',
    import.meta.url
  ),
  [TileId.PAD_R]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_R.jpg',
    import.meta.url
  ),
  [TileId.PAD_S]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_S.jpg',
    import.meta.url
  ),
  [TileId.PAD_T]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_T.jpg',
    import.meta.url
  ),
  [TileId.PAD_U]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_U.jpg',
    import.meta.url
  ),
  [TileId.PAD_V]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_V.jpg',
    import.meta.url
  ),
  [TileId.PAD_W]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_W.jpg',
    import.meta.url
  ),
  [TileId.PAD_X]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_X.jpg',
    import.meta.url
  ),
  [TileId.PAD_Y]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Y.jpg',
    import.meta.url
  ),
  [TileId.PAD_Z]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Z.jpg',
    import.meta.url
  ),
  [TileId.PAD_1]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_1.jpg',
    import.meta.url
  ),
  [TileId.PAD_2]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_2.jpg',
    import.meta.url
  ),
  [TileId.PAD_3]: new URL(
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_3.jpg',
    import.meta.url
  ),
}

const tileImg = computed(() => {
  const tileId = props.tile?.id as keyof typeof imagesMap | undefined
  const knownImage = tileId ? imagesMap[tileId] : undefined
  return knownImage?.href
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

  const followerPoints = props.followers
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
  followerPoints.forEach((point) => {
    const tileSideType =
      point.direction &&
      point.direction !== PointDirection.Center &&
      isSideName(point.direction) &&
      props.tile?.sides
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

function isSideName(direction: PointDirection): direction is SideName {
  return (
    direction === SideName.North ||
    direction === SideName.East ||
    direction === SideName.South ||
    direction === SideName.West
  )
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
