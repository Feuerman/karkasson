import tiles from '../data/tiles'
import { innsAndCathedralsTiles } from '../data/innsAndCathedralsTiles'
import { riverTiles } from '../data/riverTiles'
import { princessAndDragonTiles } from '../data/princessAndDragonTiles'
import type { TileDefinition } from '../data/tiles'
import { isCorrectTilePosition } from './gameGeometry'
import {
  ExpansionName,
  SideName,
  TileId,
  type GameRules,
  type GridTile,
  type Tile,
  type TilePlacesStats,
} from './types'

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

/** Owns deck construction, drawing, and tile placement validation. */
export class GameTileManager {
  constructor(
    private readonly state: GameTileState,
    private readonly finishGame: () => void,
    private readonly isPlacingStartTile: () => boolean
  ) {}

  findTileDefinition(tileId: string): TileDefinition | undefined {
    const standardTile = tiles.find(({ id }) => id === tileId)
    if (standardTile) return standardTile
    if (this.state.rules.expansions.princessAndDragon) {
      const princessAndDragonTile = princessAndDragonTiles.find(
        ({ id }) => id === tileId
      )
      if (princessAndDragonTile) return princessAndDragonTile
    }
    return (
      (this.state.rules.expansions.innsAndCathedrals
        ? innsAndCathedralsTiles.find(({ id }) => id === tileId)
        : undefined) ??
      (this.state.rules.expansions.river
        ? riverTiles.find(({ id }) => id === tileId)
        : undefined)
    )
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

    const hasRiverEnd = Object.values(this.state.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.id === TileId.RIVER_L)
    )
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

    const dragonAwake = Object.values(this.state.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.hasVolcano)
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
        this.isValidRiverPlacement(tile, rowIndex, tileIndex)
      )
    }

    return (
      isCorrectTilePosition(
        tile,
        rowIndex,
        tileIndex,
        this.state.tilePlacesStats,
        this.state.isEmptyGrid()
      ) && this.isValidRiverPlacement(tile, rowIndex, tileIndex)
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

  private isValidRiverPlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    if (!this.state.rules.expansions.river) return true
    if (this.isPlacingStartTile()) {
      return tile.id === TileId.RIVER_A && rowIndex === 15 && tileIndex === 15
    }
    if (!Object.keys(this.state.tilePlacesStats).length) return true
    if (tile.id === TileId.RIVER_A) return false
    const hasRiverEnd = Object.values(this.state.tilePlacesStats).some((row) =>
      Object.values(row).some((placedTile) => placedTile.id === TileId.RIVER_L)
    )
    if (hasRiverEnd) return !tile.riverGroups?.length
    if (!tile.riverGroups?.length) return false

    const riverSides = tile.riverGroups.flat()
    if (tile.riverGroups.length !== 1) return false
    if (tile.id === TileId.RIVER_A) return false

    const placedRivers = Object.values(this.state.tilePlacesStats).flatMap(
      (row) =>
        Object.values(row).filter(
          (placedTile) => placedTile.riverGroups?.length
        )
    )
    if (!placedRivers.length) return false
    if (riverSides.length < 1 || riverSides.length > 2) return false

    const oppositeSide: Record<SideName, SideName> = {
      [SideName.North]: SideName.South,
      [SideName.East]: SideName.West,
      [SideName.South]: SideName.North,
      [SideName.West]: SideName.East,
    }
    const offsets: Record<SideName, { row: number; column: number }> = {
      [SideName.North]: { row: -1, column: 0 },
      [SideName.East]: { row: 0, column: 1 },
      [SideName.South]: { row: 1, column: 0 },
      [SideName.West]: { row: 0, column: -1 },
    }
    const openEnds: Array<{
      rowIndex: number
      tileIndex: number
      side: SideName
    }> = []
    for (const [placedRowIndex, placedRow] of Object.entries(
      this.state.tilePlacesStats
    )) {
      for (const [placedTileIndex, placedTile] of Object.entries(placedRow)) {
        if (!placedTile.riverGroups?.length) continue
        const placedCoordinates = {
          rowIndex: Number(placedRowIndex),
          tileIndex: Number(placedTileIndex),
        }
        for (const side of placedTile.riverGroups.flat()) {
          const offset = offsets[side]
          const neighbor =
            this.state.tilePlacesStats[
              placedCoordinates.rowIndex + offset.row
            ]?.[placedCoordinates.tileIndex + offset.column]
          if (
            !neighbor?.riverGroups?.some((group) =>
              group.includes(oppositeSide[side])
            )
          ) {
            openEnds.push({ ...placedCoordinates, side })
          }
        }
      }
    }
    if (openEnds.length !== 1) return false

    const openEnd = openEnds[0]
    const connections = (Object.keys(offsets) as SideName[]).flatMap((side) => {
      const offset = offsets[side]
      const neighborRow = rowIndex + offset.row
      const neighborColumn = tileIndex + offset.column
      const neighbor = this.state.tilePlacesStats[neighborRow]?.[neighborColumn]
      return neighbor?.riverGroups?.some((group) =>
        group.includes(oppositeSide[side])
      )
        ? [{ side, rowIndex: neighborRow, tileIndex: neighborColumn }]
        : []
    })
    const connection = connections[0]
    if (
      connections.length !== 1 ||
      !connection ||
      !openEnd ||
      connection.rowIndex !== openEnd.rowIndex ||
      connection.tileIndex !== openEnd.tileIndex ||
      openEnd.side !== oppositeSide[connection.side] ||
      !riverSides.includes(connection.side)
    ) {
      return false
    }

    return tile.id === TileId.RIVER_L
      ? riverSides.length === 1
      : riverSides.length === 2
  }
}
