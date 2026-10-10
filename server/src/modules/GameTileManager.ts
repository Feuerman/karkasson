import tiles from '../data/tiles'
import { innsAndCathedralsTiles } from '../data/innsAndCathedralsTiles'
import { riverTiles } from '../data/riverTiles'
import { princessAndDragonTiles } from '../data/princessAndDragonTiles'
import { findTileDefinitionById } from '../data/tileDefinitions'
import type { TileDefinition } from '../data/tiles'
import {
  isCorrectTilePosition,
  neighborCoordinates,
  NEIGHBOR_SIDES,
} from './gameGeometry'
import {
  ExpansionName,
  OPPOSITE_SIDE,
  SideName,
  TileId,
  type GameRules,
  type GridTile,
  type RiverPlacementConflict,
  type Tile,
  type TilePlacesStats,
} from './types'

/** Сторона уже стоящего тайла, у которой русло осталось открытым. */
interface RiverOpenEnd {
  rowIndex: number
  tileIndex: number
  side: SideName
}

interface GameTileState {
  gameIsEnded: boolean
  rules: GameRules
  tilesList: Tile[]
  currentTile: GridTile | null
  tilePlacesStats: TilePlacesStats
  availablePlacesTiles: Array<{ rowIndex: number; tileIndex: number }>
  isEmptyGrid(): boolean
  rotateTile(tile: Tile): Tile
  updateTileHistory(tile: Tile): void
}

function shuffleTiles(tilesToShuffle: Tile[]): Tile[] {
  for (let index = tilesToShuffle.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const tile = tilesToShuffle[index]
    tilesToShuffle[index] = tilesToShuffle[randomIndex]
    tilesToShuffle[randomIndex] = tile
  }
  return tilesToShuffle
}

function createTileCopies(definitions: TileDefinition[]): Tile[] {
  return definitions.flatMap<Tile>((tile) =>
    Array.from({ length: tile.count }, () => ({ ...tile, rotation: 0 }))
  )
}

/** Конфликт для открытого конца русла на подсвечиваемом соседе. */
function toRiverConflict(
  openEnd: { rowIndex: number; tileIndex: number; side: SideName },
  reason: RiverPlacementConflict['reason']
): RiverPlacementConflict {
  return {
    reason,
    side: openEnd.side,
    rowIndex: openEnd.rowIndex,
    tileIndex: openEnd.tileIndex,
  }
}

/** Owns deck construction, drawing, and tile placement validation. */
export class GameTileManager {
  constructor(
    private readonly state: GameTileState,
    private readonly finishGame: () => void,
    private readonly isPlacingStartTile: () => boolean
  ) {}

  findTileDefinition(tileId: string): TileDefinition | undefined {
    return findTileDefinitionById(tileId, this.state.rules)
  }

  initializeDeck() {
    const standardDefinitions = [
      ...tiles,
      ...(this.state.rules.expansions.innsAndCathedrals
        ? innsAndCathedralsTiles
        : []),
      ...(this.state.rules.expansions.princessAndDragon
        ? princessAndDragonTiles
        : []),
    ]
    const standardTiles = shuffleTiles(createTileCopies(standardDefinitions))

    if (!this.state.rules.expansions.river) {
      this.state.tilesList = standardTiles
      return
    }

    const middleRiverTiles = shuffleTiles(
      createTileCopies(riverTiles.filter((tile) => tile.id !== TileId.RIVER_L))
    )
    const riverEnd = riverTiles.find(({ id }) => id === TileId.RIVER_L)
    if (!riverEnd) throw new Error('River expansion has no ending tile')

    this.state.tilesList = [
      ...middleRiverTiles,
      { ...riverEnd, rotation: 0 },
      ...standardTiles,
    ]
  }

  drawNextTile() {
    if (this.state.gameIsEnded) return
    if (!this.state.tilesList.length) {
      this.finishGame()
      return
    }

    const hasRiverEnd = this.hasRiverEnd()
    if (this.state.rules.expansions.river && !hasRiverEnd) {
      const nextRiverTile = this.state.tilesList[0]
      if (!nextRiverTile || nextRiverTile.expansion !== ExpansionName.River) {
        this.finishGame()
        return
      }

      this.state.tilesList.shift()
      const tile = { ...nextRiverTile, rotation: 0 }
      this.state.currentTile = { x: 0, y: 0, ...tile }
      this.state.updateTileHistory(tile)
      return
    }

    if (this.state.rules.expansions.river && hasRiverEnd) {
      this.state.tilesList = this.state.tilesList.filter(
        (tile) => tile.expansion !== ExpansionName.River
      )
    }

    // Дракон просыпается на вулкане: пока дракон на доске, тайлы с драконом
    // не выдаём, иначе игрок не сможет сделать ход.
    const dragonAwake = this.hasPlacedTile((placedTile) =>
      Boolean(placedTile.hasVolcano)
    )
    const tilesToCheck = this.state.tilesList.length
    const checkedTiles = new Set<Tile>()

    for (let index = 0; index < tilesToCheck; index += 1) {
      const tileIndex = this.state.tilesList.findIndex(
        (tile) => !checkedTiles.has(tile)
      )
      if (tileIndex === -1) break
      const [tile] = this.state.tilesList.splice(tileIndex, 1)
      if (!tile) break

      if (
        (dragonAwake || !tile.hasDragon) &&
        this.checkAvailablePlacesForTile({ ...tile, rotation: 0 })
      ) {
        this.state.currentTile = { x: 0, y: 0, ...tile, rotation: 0 }
        this.state.updateTileHistory(tile)
        return
      }

      checkedTiles.add(tile)
      if (!dragonAwake && tile.hasDragon) {
        const randomIndex = Math.floor(
          Math.random() * (this.state.tilesList.length + 1)
        )
        this.state.tilesList.splice(randomIndex, 0, tile)
      } else {
        this.state.tilesList.push(tile)
      }
    }

    this.finishGame()
  }

  /** Есть ли на доске хотя бы один тайл, удовлетворяющий условию. */
  hasPlacedTile(predicate: (tile: GridTile) => boolean): boolean {
    return Object.values(this.state.tilePlacesStats).some((row) =>
      Object.values(row).some(predicate)
    )
  }

  /**
   * Стоит ли на доске тайл, закрывающий русло. Пока его нет, ход River обязателен,
   * а после его постановки остальные речные тайлы убираются из колоды.
   */
  hasRiverEnd(): boolean {
    return this.hasPlacedTile((placedTile) => placedTile.id === TileId.RIVER_L)
  }

  checkAvailablePlacesForTile(tile: Tile): boolean {
    return Boolean(this.getValidTileRotation(tile))
  }

  isValidTilePlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    if (
      this.state.rules.expansions.river &&
      tile.expansion === ExpansionName.River
    ) {
      return (
        !this.state.tilePlacesStats[rowIndex]?.[tileIndex] &&
        this.checkRiverPlacement(tile, rowIndex, tileIndex).valid
      )
    }

    return (
      isCorrectTilePosition(
        tile,
        rowIndex,
        tileIndex,
        this.state.tilePlacesStats,
        this.state.isEmptyGrid()
      ) && this.checkRiverPlacement(tile, rowIndex, tileIndex).valid
    )
  }

  isCorrectTilePosition(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    return isCorrectTilePosition(
      tile,
      rowIndex,
      tileIndex,
      this.state.tilePlacesStats,
      this.state.isEmptyGrid()
    )
  }

  private getValidTileRotation(tile: Tile): Tile | undefined {
    for (const place of this.state.availablePlacesTiles) {
      for (const rotationCount of [0, 1, 2, 3]) {
        let processedTile: Tile = { ...tile }
        for (let index = 0; index < rotationCount; index += 1) {
          processedTile = this.state.rotateTile(processedTile)
        }

        if (
          this.isValidTilePlacement(
            processedTile,
            place.rowIndex,
            place.tileIndex
          )
        ) {
          return processedTile
        }
      }
    }
    return undefined
  }

  /** Проверка правил реки; conflict заполняется для диагностики отказа. */
  /**
   * Открытые концы русла среди уже стоящих тайлов: сторона, у которой сосед
   * не продолжает русло. Пока концов ровно один, речной тайл можно продолжить.
   */
  private findOpenRiverEnds(): RiverOpenEnd[] {
    const openEnds: RiverOpenEnd[] = []
    for (const [placedRowIndex, placedRow] of Object.entries(
      this.state.tilePlacesStats
    )) {
      for (const [placedTileIndex, placedTile] of Object.entries(placedRow)) {
        if (!placedTile.riverGroups?.length) continue
        const coordinates = {
          rowIndex: Number(placedRowIndex),
          tileIndex: Number(placedTileIndex),
        }
        for (const side of placedTile.riverGroups.flat()) {
          const neighbor = NEIGHBOR_SIDES.find(
            (candidate) => candidate.side === side
          )
          if (!neighbor) continue
          const adjacent = neighborCoordinates(
            coordinates.rowIndex,
            coordinates.tileIndex,
            neighbor
          )
          const adjacentTile =
            this.state.tilePlacesStats[adjacent.rowIndex]?.[adjacent.tileIndex]
          if (
            !adjacentTile?.riverGroups?.some((group) =>
              group.includes(neighbor.oppositeSide)
            )
          ) {
            openEnds.push({ ...coordinates, side })
          }
        }
      }
    }
    return openEnds
  }

  private checkRiverPlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): { valid: boolean; conflict?: RiverPlacementConflict } {
    if (!this.state.rules.expansions.river) return { valid: true }
    if (this.isPlacingStartTile()) {
      return {
        valid:
          tile.id === TileId.RIVER_A && rowIndex === 15 && tileIndex === 15,
      }
    }
    if (!Object.keys(this.state.tilePlacesStats).length) return { valid: true }
    if (tile.id === TileId.RIVER_A) return { valid: false }
    const hasRiverEnd = Object.values(this.state.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.id === TileId.RIVER_L)
    )
    if (hasRiverEnd) return { valid: !tile.riverGroups?.length }
    if (!tile.riverGroups?.length) return { valid: false }

    const riverSides = tile.riverGroups.flat()
    if (tile.riverGroups.length !== 1) return { valid: false }
    if (tile.id === TileId.RIVER_A) return { valid: false }

    const placedRivers = Object.values(this.state.tilePlacesStats).flatMap(
      (row) =>
        Object.values(row).filter(
          (placedTile) => placedTile.riverGroups?.length
        )
    )
    if (!placedRivers.length) return { valid: false }
    if (riverSides.length < 1 || riverSides.length > 2) return { valid: false }

    // Русло должно продолжить ровно один открытый конец среди уже стоящих
    // тайлов и не открывать новых: у открытого конца и у выхода нового тайла
    // должны совпасть клетка и сторона.
    const openEnds = this.findOpenRiverEnds()
    if (openEnds.length !== 1) return { valid: false }

    const openEnd = openEnds[0]
    const connections = NEIGHBOR_SIDES.flatMap((side) => {
      const adjacent = neighborCoordinates(rowIndex, tileIndex, side)
      const neighbor =
        this.state.tilePlacesStats[adjacent.rowIndex]?.[adjacent.tileIndex]
      return neighbor?.riverGroups?.some((group) =>
        group.includes(side.oppositeSide)
      )
        ? [{ side: side.side, ...adjacent }]
        : []
    })
    const connection = connections[0]
    if (
      connections.length !== 1 ||
      !connection ||
      !openEnd ||
      connection.rowIndex !== openEnd.rowIndex ||
      connection.tileIndex !== openEnd.tileIndex ||
      openEnd.side !== OPPOSITE_SIDE[connection.side]
    ) {
      return {
        valid: false,
        conflict: toRiverConflict(openEnd, 'openEnd'),
      }
    }
    if (!riverSides.includes(connection.side)) {
      return {
        valid: false,
        conflict: toRiverConflict(openEnd, 'wrongSide'),
      }
    }
    const exitSide = riverSides.find((side) => side !== connection.side)
    if (exitSide === SideName.North) {
      return {
        valid: false,
        conflict: toRiverConflict(openEnd, 'wrongSide'),
      }
    }

    return {
      valid:
        tile.id === TileId.RIVER_L
          ? riverSides.length === 1
          : riverSides.length === 2,
    }
  }

  /** Причина отказа по правилам реки; undefined, если размещение проходит. */
  getRiverConflict(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): RiverPlacementConflict | undefined {
    return this.checkRiverPlacement(tile, rowIndex, tileIndex).conflict
  }
}
