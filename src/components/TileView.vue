<template>
  <div
    class="relative flex h-full w-full items-center justify-center overflow-hidden"
  >
    <template v-if="props.tile?.imgUrl">
      <img
        :src="tileSrc"
        :class="rotateClass"
        class="block h-full w-full scale-[1.08] object-cover transition-transform duration-200 ease-in-out"
        :alt="t('tile_image_alt', { id: props.tile?.id ?? '' })"
        @load="drawTile"
      />
      <canvas
        ref="canvas"
        :width="size"
        :height="size"
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.08] transition-transform duration-200 ease-in-out"
      ></canvas>
      <div
        v-if="followerPreview && followerPreviewPosition"
        class="pointer-events-none absolute inset-0 z-10 scale-[1.08]"
        aria-hidden="true"
      >
        <div
          class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_16px_rgba(255,255,255,0.6)] box-border"
          :style="{
            left: `${followerPreviewPosition[0] * 100}%`,
            top: `${followerPreviewPosition[1] * 100}%`,
            width: previewOuterSize + 'px',
            height: previewOuterSize + 'px',
            backgroundColor: followerPreview.playerColor,
          }"
        >
          <div
            class="absolute inset-0 rounded-full box-border"
            :style="{
              width: previewInnerSize + 'px',
              height: previewInnerSize + 'px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: followerPreview.playerColor,
            }"
          />
          <div
            v-if="previewShowCross"
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
            :style="{
              width: previewOuterSize + 'px',
              height: previewOuterSize + 'px',
            }"
          >
            <div
              class="absolute bg-[rgba(255,255,255,0.9)]"
              :style="{
                width: previewCrossStroke + 'px',
                height: previewCrossLength + 'px',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%)`,
              }"
            />
            <div
              class="absolute bg-[rgba(255,255,255,0.9)]"
              :style="{
                width: previewCrossLength + 'px',
                height: previewCrossStroke + 'px',
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%)`,
              }"
            />
          </div>
        </div>
      </div>
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
  TileSideType,
  type FieldFollower,
  type FollowerType,
  type PlayerView,
  type PlayerId,
  type PlacedFollower,
  type Point,
  type Tile,
} from '@server/modules/types'
import { rotationClass } from '@/utils/tiles'
import {
  getFieldFollowerPosition,
  getFollowerPosition,
  isTileId,
} from '@/utils/followerPositions'
import { playerColorValue } from '@/utils/colors'
import { loadTileImage } from '@/utils/tileImages'
import type { RulesTileRef } from '@/rules/types'
import { t } from '@/utils/i18n'

const props = withDefaults(
  defineProps<{
    tile?: Tile | RulesTileRef | null
    size?: number
    followers?: PlacedFollower[]
    fieldFollowers?: FieldFollower[]
    followerPreview?: {
      point: Point
      followerType: FollowerType
      playerColor: string
    } | null
    players?: PlayerView[]
  }>(),
  {
    tile: null,
    size: 110,
    followers: () => [],
    fieldFollowers: () => [],
    followerPreview: null,
    players: () => [],
  }
)

const tileSrc = ref<string | undefined>(undefined)

/** Загружает изображение тайла лениво при первом отображении. */
const loadTile = async (tileId: TileId | undefined) => {
  if (!tileId) {
    tileSrc.value = undefined
    return
  }
  const url = await loadTileImage(tileId)
  tileSrc.value = url
}

watch(
  () => props.tile?.id,
  (tileId) => {
    void loadTile(tileId as TileId | undefined)
  },
  { immediate: true }
)

const rotateClass = computed(() => rotationClass(props.tile?.rotation ?? 0))

const followerPreviewPosition = computed(() => {
  const preview = props.followerPreview
  const point = preview?.point
  const tileId = String(props.tile?.id ?? '')
  if (!point || !isTileId(tileId)) return null

  const rotation = Number(props.tile?.rotation ?? 0)
  if (point.pointType === TileSideType.Field) {
    const topology =
      props.tile && 'fieldTopology' in props.tile
        ? props.tile.fieldTopology
        : undefined
    return getFieldFollowerPosition(point.regionIndex, rotation, topology)
  }

  return getFollowerPosition(tileId, point.direction, rotation, point.pointType)
})

const previewOuterSize = computed(() => {
  const type = props.followerPreview?.followerType
  return type === 'bigFollower' ? 28 : 22
})

const previewInnerSize = computed(() => {
  const type = props.followerPreview?.followerType
  return type === 'bigFollower' ? 22 : 17
})

const previewShowCross = computed(() => {
  const type = props.followerPreview?.followerType
  return type === 'abbot' || type === 'bigFollower'
})

const previewCrossStroke = computed(() => 2)

const previewCrossLength = computed(() => {
  const type = props.followerPreview?.followerType
  return type === 'bigFollower' ? 10 : 6.4
})

const canvas = ref<HTMLCanvasElement | null>(null)

const drawTile = () => {
  if (!canvas.value) return

  const ctx = canvas.value.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

  // Настройки стиля для точек
  ctx.lineWidth = 2

  const followerPoints = props.followers.map((follower) => {
    return {
      ...follower.point,
      playerId: follower.playerId,
      isAbbot: follower.isAbbot,
      isBigFollower: follower.isBigFollower,
      isGarden: follower.isGarden,
    }
  })

  const fieldPoints = props.fieldFollowers.map((follower) => {
    return {
      ...follower.point,
      playerId: follower.playerId,
      isBigFollower: follower.isBigFollower,
      regionIndex: follower.point.regionIndex,
    }
  })

  // Рисуем каждую точку с учетом направления
  const drawPoint = (point: {
    x: number
    y: number
    playerId: PlayerId
    isBigFollower?: boolean
    isAbbot?: boolean
    isGarden?: boolean
    direction?: PointDirection
    pointType?: import('@server/modules/types').PointType
    regionIndex?: number
  }) => {
    const isField = point.pointType === TileSideType.Field
    let normalizedX = 0.5
    let normalizedY = 0.5

    if (isField && isTileId(String(props.tile?.id ?? ''))) {
      const fieldTopology =
        props.tile && 'fieldTopology' in props.tile
          ? props.tile.fieldTopology
          : undefined
      ;[normalizedX, normalizedY] = getFieldFollowerPosition(
        point.regionIndex,
        Number(props.tile?.rotation ?? 0),
        fieldTopology
      )
    } else {
      const tileSideType =
        point.direction &&
        point.direction !== PointDirection.Center &&
        isSideName(point.direction) &&
        props.tile &&
        'sides' in props.tile
          ? props.tile.sides[point.direction]
          : undefined
      const tileId = String(props.tile?.id ?? '')
      ;[normalizedX, normalizedY] = isTileId(tileId)
        ? getFollowerPosition(
            tileId,
            point.direction,
            Number(props.tile?.rotation ?? 0),
            point.pointType ?? tileSideType,
            point.isGarden
          )
        : [0.5, 0.5]
    }
    const x = normalizedX * props.size
    const y = normalizedY * props.size

    const player = props.players?.find(
      ({ id }) => String(id) === String(point.playerId)
    )
    const playerColor = playerColorValue(player?.color)

    // Белый ореал для читаемости на фоне тайла
    ctx.save()
    if (isField) {
      // Крестьян кладут плашмя: овальная форма отделяет их от стоящих
      // подданных и лучше читается на рисунке поля.
      ctx.translate(x, y)
      ctx.scale(1, 0.55)
    }
    const markerX = isField ? 0 : x
    const markerY = isField ? 0 : y
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(markerX, markerY, point.isBigFollower ? 14 : 11, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fill()

    // Цветное ядро маркера
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(markerX, markerY, point.isBigFollower ? 11 : 8.5, 0, Math.PI * 2)
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
      ctx.moveTo(markerX - arm, markerY)
      ctx.lineTo(markerX + arm, markerY)
      ctx.moveTo(markerX, markerY - arm)
      ctx.lineTo(markerX, markerY + arm)
      ctx.stroke()
    }

    ctx.restore()
  }

  followerPoints.forEach(drawPoint)
  fieldPoints.forEach(drawPoint)
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
  }
)

watch(
  () => props.fieldFollowers,
  () => {
    nextTick(() => {
      drawTile()
    })
  }
)

watch(
  () => props.tile,
  () => {
    nextTick(() => {
      drawTile()
    })
  }
)
</script>
