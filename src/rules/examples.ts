import { tiles } from '@/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { riverTiles } from '@server/data/riverTiles'
import {
  OPPOSITE_SIDE,
  PointDirection,
  SideName,
  type TileId,
  TileSideType,
  type TileSideType as TileSideTypeValue,
} from '@server/modules/types'
import type {
  RulesGridCell,
  RulesMarker,
  RulesMarkerColor,
  RulesRotation,
  RulesTileRef,
} from './types'
import { RulesMarkerKind } from './types'

const SIDE_ORDER = [
  SideName.North,
  SideName.East,
  SideName.South,
  SideName.West,
] as const

type CompassDirection = (typeof SIDE_ORDER)[number]

const SIDE_INDEX: Record<CompassDirection, number> = {
  [SideName.North]: 0,
  [SideName.East]: 1,
  [SideName.South]: 2,
  [SideName.West]: 3,
}

const tileDataById = (id: string) => {
  return (
    tiles.find((tile) => tile.id === id) ??
    innsAndCathedralsTiles.find((tile) => tile.id === id) ??
    riverTiles.find((tile) => tile.id === id)
  )
}

const withMarkers = (tile: RulesTileRef, markers: RulesMarker[]) => ({
  ...tile,
  markers: [...(tile.markers ?? []), ...markers],
})

/**
 * Строит ссылку на тайл. Берёт картинку из клиентской копии колоды,
 * чтобы TileView рендерил изображение независимо от серверных путей.
 */
export const rot = (id: TileId, rotation: RulesRotation = 0): RulesTileRef => {
  const data = tileDataById(id)
  if (!data) {
    throw new Error(`[rules] Неизвестный id тайла в примере: ${id}`)
  }
  return {
    id,
    rotation,
    imgUrl: data.imgUrl,
    ...(data.hasGarden ? { hasGarden: true } : {}),
    ...(data.hasInn ? { hasInn: true } : {}),
    ...(data.hasCathedral ? { hasCathedral: true } : {}),
  }
}

/** Тайл с садом для наглядных примеров правил. */
export const garden = (
  id: TileId,
  rotation: RulesRotation = 0
): RulesTileRef => {
  if (!tileDataById(id)?.hasGarden) {
    throw new Error(`[rules] Для тайла ${id} не предусмотрен сад`)
  }
  return rot(id, rotation)
}

/** Клетка сетки из тайла с произвольным набором маркеров. */
export const cell = (
  tile: RulesTileRef,
  ...markers: RulesMarker[]
): RulesGridCell => ({
  tile: markers.length ? withMarkers(tile, markers) : tile,
})

/** Тайл с цветной точкой подданного на грани (или в центре монастыря). */
export const placed = (
  tile: RulesTileRef,
  color: RulesMarkerColor,
  direction: CompassDirection | typeof PointDirection.Center
): RulesGridCell =>
  cell(tile, { kind: RulesMarkerKind.Follower, color, direction })

/** Тайл, обозначенный как «только что выложенный» (синяя пунктирная рамка). */
export const newly = (tile: RulesTileRef): RulesGridCell =>
  cell(tile, { kind: RulesMarkerKind.New })

/** Тайл, относящийся к завершённому объекту (зелёная рамка). */
export const completed = (tile: RulesTileRef): RulesGridCell =>
  cell(tile, { kind: RulesMarkerKind.Completed })

/** Тайл с пометкой «недопустимо» на конкретной грани (красный крестик). */
export const invalid = (
  tile: RulesTileRef,
  direction: CompassDirection | typeof PointDirection.Center
): RulesGridCell => cell(tile, { kind: RulesMarkerKind.Invalid, direction })

/** Выпадающая пустая клетка сетки. */
export const empty: RulesGridCell = {}

/** Создаёт сетку примера из строк, где null заменяется пустой клеткой. */
export const grid = (rows: (RulesGridCell | null)[][]): RulesGridCell[][] => {
  return rows.map((row) => row.map((entry) => entry ?? empty))
}

/** Тип стороны тайла с учётом поворота (по часовой стрелке). */
export const sideOf = (
  tile: RulesTileRef,
  direction: CompassDirection
): TileSideTypeValue | undefined => {
  const data = tileDataById(tile.id)
  if (!data) return undefined
  const rotations = ((tile.rotation ?? 0) / 90) % 4
  const baseDirection = SIDE_ORDER[(SIDE_INDEX[direction] - rotations + 4) % 4]
  return data.sides[baseDirection]
}

/**
 * Проверяет корректность примера: совпадение прилегающих граней
 * и осмысленность маркеров. Возвращает список замечаний.
 *
 * Примеры с intentionalMismatch=true (демонстрация неверной позиции)
 * пропускаются при проверке граней, но не при проверке маркеров.
 */
export const validateExampleGrid = (
  exampleCells: RulesGridCell[][],
  exampleId: string,
  intentionalMismatch = false
): string[] => {
  const errors: string[] = []

  exampleCells.forEach((row, y) => {
    row.forEach((cellEntry, x) => {
      const tile = cellEntry?.tile
      if (!tile) return

      if (!intentionalMismatch) {
        SIDE_ORDER.forEach((direction) => {
          const delta: Record<CompassDirection, [number, number]> = {
            [SideName.North]: [0, -1],
            [SideName.East]: [1, 0],
            [SideName.South]: [0, 1],
            [SideName.West]: [-1, 0],
          }
          const [dx, dy] = delta[direction]
          const neighborTile = exampleCells[y + dy]?.[x + dx]?.tile
          if (!neighborTile) return

          const own = sideOf(tile, direction)
          const theirs = sideOf(neighborTile, OPPOSITE_SIDE[direction])
          if (own !== theirs) {
            errors.push(
              `[${exampleId}] клетка (${x},${y}) грань ${direction} ` +
                `(${own}) не совпадает с соседней (${theirs})`
            )
          }
        })
      }

      ;(tile.markers ?? []).forEach((marker) => {
        if (
          marker.kind === RulesMarkerKind.Follower ||
          marker.kind === RulesMarkerKind.Invalid
        ) {
          if (marker.direction === PointDirection.Center) {
            if (
              !tileDataById(tile.id)?.isMonastery &&
              !tileDataById(tile.id)?.hasGarden
            ) {
              errors.push(
                `[${exampleId}] маркер «center» на (${x},${y}) — тайл не монастырь и не сад`
              )
            }
          } else {
            const sideType = sideOf(tile, marker.direction)
            if (
              sideType !== TileSideType.City &&
              sideType !== TileSideType.Road
            ) {
              errors.push(
                `[${exampleId}] маркер на (${x},${y}) грань ` +
                  `${marker.direction} стоит на стороне «${sideType}», а не на объекте`
              )
            }
          }
        }
      })
    })
  })

  return errors
}

export const validateExampleGrids = (
  examples: {
    id: string
    grid: RulesGridCell[][]
    intentionalMismatch?: boolean
  }[]
): string[] => {
  return examples.flatMap((example) =>
    validateExampleGrid(example.grid, example.id, example.intentionalMismatch)
  )
}
