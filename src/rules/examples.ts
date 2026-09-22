import { tiles } from '@/data/tiles'
import type { TileSideType } from '@server/modules/types'
import type {
  RulesGridCell,
  RulesMarker,
  RulesMarkerColor,
  RulesRotation,
  RulesTileRef,
} from './types'

const SIDE_ORDER = ['north', 'east', 'south', 'west'] as const

type CompassDirection = (typeof SIDE_ORDER)[number]

const SIDE_INDEX: Record<CompassDirection, number> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
}

const OPPOSITE: Record<CompassDirection, CompassDirection> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
}

const tileDataById = (id: string) => {
  return tiles.find((tile) => tile.id === id)
}

const withMarkers = (tile: RulesTileRef, markers: RulesMarker[]) => ({
  ...tile,
  markers: [...(tile.markers ?? []), ...markers],
})

/**
 * Строит ссылку на тайл. Берёт картинку из клиентской копии колоды,
 * чтобы TileView рендерил изображение независимо от серверных путей.
 */
export const rot = (id: string, rotation: RulesRotation = 0): RulesTileRef => {
  const data = tileDataById(id)
  if (!data) {
    throw new Error(`[rules] Неизвестный id тайла в примере: ${id}`)
  }
  return { id, rotation, imgUrl: data.imgUrl }
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
  direction: CompassDirection | 'center'
): RulesGridCell => cell(tile, { kind: 'follower', color, direction })

/** Тайл, обозначенный как «только что выложенный» (синяя пунктирная рамка). */
export const newly = (tile: RulesTileRef): RulesGridCell =>
  cell(tile, { kind: 'new' })

/** Тайл, относящийся к завершённому объекту (зелёная рамка). */
export const completed = (tile: RulesTileRef): RulesGridCell =>
  cell(tile, { kind: 'completed' })

/** Тайл с пометкой «недопустимо» на конкретной грани (красный крестик). */
export const invalid = (
  tile: RulesTileRef,
  direction: CompassDirection | 'center'
): RulesGridCell => cell(tile, { kind: 'no', direction })

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
): TileSideType | undefined => {
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
            north: [0, -1],
            east: [1, 0],
            south: [0, 1],
            west: [-1, 0],
          }
          const [dx, dy] = delta[direction]
          const neighborTile = exampleCells[y + dy]?.[x + dx]?.tile
          if (!neighborTile) return

          const own = sideOf(tile, direction)
          const theirs = sideOf(neighborTile, OPPOSITE[direction])
          if (own !== theirs) {
            errors.push(
              `[${exampleId}] клетка (${x},${y}) грань ${direction} ` +
                `(${own}) не совпадает с соседней (${theirs})`
            )
          }
        })
      }

      ;(tile.markers ?? []).forEach((marker) => {
        if (marker.kind === 'follower' || marker.kind === 'no') {
          if (marker.direction === 'center') {
            if (!tileDataById(tile.id)?.isMonastery) {
              errors.push(
                `[${exampleId}] маркер «center» на (${x},${y}) — тайл не монастырь`
              )
            }
          } else {
            const sideType = sideOf(tile, marker.direction)
            if (sideType !== 'city' && sideType !== 'road') {
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
