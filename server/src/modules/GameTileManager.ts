import {
  EXPANSION_TILE_SETS,
  findTileDefinition,
  tilesForRules,
} from '../data/tileCatalog'
import type { TileDefinition } from '../data/tiles'
import {
  boardCenterCoordinates,
  isCorrectTilePosition,
  neighborCoordinates,
  NEIGHBOR_SIDES,
} from './gameGeometry'
import type { TileBoard } from './boardState'
import {
  ExpansionName,
  OPPOSITE_SIDE,
  SideName,
  TileId,
  type GridTile,
  type RiverPlacementConflict,
  type Tile,
  type TileSideType,
} from './types'

/** Сторона уже стоящего тайла, у которой русло осталось открытым. */
interface RiverOpenEnd {
  rowIndex: number
  tileIndex: number
  side: SideName
}

/**
 * Требования клетки к сторонам тайла.
 *
 * Клетка требует от тайла ровно одного: чтобы каждая его сторона совпадала
 * с той стороной соседа, к которой примыкает. Требования считаются один раз
 * на розыгрыш: раньше соседи перебирались заново для каждого тайла колоды и
 * каждого поворота, а это десятки тысяч проверок на ход.
 */
interface PlacementCell {
  rowIndex: number
  tileIndex: number
  /** Требуемая сторона тайла по направлениям; соседа нет — требования нет. */
  required: Partial<Record<SideName, TileSideType>>
}

/**
 * Состояние русла на момент розыгрыша: считается один раз, а не заново для
 * каждого тайла и каждой клетки.
 */
interface RiverState {
  /** На доске есть тайл, закрывающий русло. */
  hasRiverEnd: boolean
  /** Открытые концы русла среди стоящих тайлов. */
  openEnds: RiverOpenEnd[]
  /** Сколько тайлов с руслом уже стоит на доске. */
  placedRiverTiles: number
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
    private readonly state: TileBoard,
    private readonly finishGame: () => void,
    private readonly isPlacingStartTile: () => boolean
  ) {}

  findTileDefinition(tileId: string): TileDefinition | undefined {
    return findTileDefinition(tileId, this.state.rules)
  }

  /**
   * Стартовый тайл партии: с River русло начинается с `RIVER_A`, в базовой игре
   * это классический тайл D.
   */
  private get startTileId(): TileId {
    return this.state.rules.expansions.river ? TileId.RIVER_A : TileId.D
  }

  /**
   * Забирает стартовый тайл из колоды: форму берём из каталога с учётом
   * расширений, а его копию удаляем, чтобы тайл не выпал позже. Поворот всегда
   * нулевой: стартовые тайлы ориентированы выходом на доску.
   */
  takeStartTile(): Tile {
    const startTileId = this.startTileId
    const definition = findTileDefinition(startTileId, this.state.rules)
    if (!definition) throw new Error('Game has no starting tile')

    // В колоде партии лежит ровно одна копия стартового тайла. Если её там нет
    // (колода собрана вручную), убирать нечего — старт всё равно ставится.
    const deckIndex = this.state.tilesList.findIndex(
      (tile) => tile.id === startTileId
    )
    if (deckIndex !== -1) this.state.tilesList.splice(deckIndex, 1)

    return { ...definition, rotation: 0 }
  }

  initializeDeck() {
    const rules = this.state.rules
    // Состав колоды берётся из каталога: перечень тайлов по дополнениям живёт
    // в одном месте. Речные тайлы в ordinary-часть не входят — они раздаются
    // первыми.
    const standardDefinitions = tilesForRules({
      ...rules,
      expansions: { ...rules.expansions, river: false },
    })
    const standardTiles = shuffleTiles(createTileCopies(standardDefinitions))

    if (!rules.expansions.river) {
      this.state.tilesList = standardTiles
      return
    }

    const riverDefinitions = EXPANSION_TILE_SETS[ExpansionName.River]
    const middleRiverTiles = shuffleTiles(
      createTileCopies(
        riverDefinitions.filter((tile) => tile.id !== TileId.RIVER_L)
      )
    )
    const riverEnd = riverDefinitions.find(({ id }) => id === TileId.RIVER_L)
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
    const rejectedTiles: Tile[] = []
    const rejectedDragonTiles: Tile[] = []

    // Требования клеток и состояние русла считаются один раз на розыгрыш:
    // дальше каждый тайл колоды проверяется по ним без перебора соседей.
    const cells = this.collectPlacementCells()
    const river = this.collectRiverState()

    for (let index = 0; index < tilesToCheck; index += 1) {
      const tile = this.state.tilesList[index]
      if (!tile) continue
      if (
        (dragonAwake || !tile.hasDragon) &&
        this.checkAvailablePlacesForTile({ ...tile, rotation: 0 }, cells, river)
      ) {
        const remainingTiles = [
          tile,
          ...this.state.tilesList.slice(index + 1, tilesToCheck),
          ...rejectedTiles,
        ]
        for (const dragonTile of rejectedDragonTiles) {
          const randomIndex = Math.floor(
            Math.random() * (remainingTiles.length + 1)
          )
          remainingTiles.splice(randomIndex, 0, dragonTile)
        }
        const selectedTileIndex = remainingTiles.indexOf(tile)
        if (selectedTileIndex !== -1) {
          remainingTiles.splice(selectedTileIndex, 1)
        }
        this.state.tilesList = remainingTiles
        this.state.currentTile = { x: 0, y: 0, ...tile, rotation: 0 }
        this.state.updateTileHistory(tile)
        return
      }
      if (!dragonAwake && tile.hasDragon) rejectedDragonTiles.push(tile)
      else rejectedTiles.push(tile)
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

  checkAvailablePlacesForTile(
    tile: Tile,
    cells: PlacementCell[],
    river: RiverState
  ): boolean {
    return Boolean(this.getValidTileRotation(tile, cells, river))
  }

  isValidTilePlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): boolean {
    const riverEnabled = this.state.rules.expansions.river

    if (riverEnabled && tile.expansion === ExpansionName.River) {
      return (
        !this.state.tilePlacesStats[rowIndex]?.[tileIndex] &&
        this.checkRiverPlacement(tile, rowIndex, tileIndex).valid
      )
    }

    if (
      riverEnabled &&
      !this.checkRiverPlacement(tile, rowIndex, tileIndex).valid
    ) {
      return false
    }

    return isCorrectTilePosition(
      tile,
      rowIndex,
      tileIndex,
      this.state.tilePlacesStats,
      this.state.isEmptyGrid()
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

  /**
   * Требования свободных клеток к сторонам тайла.
   *
   * Клетка без соседей не годится: тайл рядом с путём не поставить. На
   * пустой доске требований нет вовсе — там годится любая клетка.
   */
  private collectPlacementCells(): PlacementCell[] {
    const isGridEmpty = this.state.isEmptyGrid()
    const cells: PlacementCell[] = []

    for (const place of this.state.availablePlacesTiles) {
      if (this.state.tilePlacesStats[place.rowIndex]?.[place.tileIndex]) {
        continue
      }

      const required: Partial<Record<SideName, TileSideType>> = {}
      let hasNeighbor = false
      for (const neighbor of NEIGHBOR_SIDES) {
        const coordinates = neighborCoordinates(
          place.rowIndex,
          place.tileIndex,
          neighbor
        )
        const adjacent =
          this.state.tilePlacesStats[coordinates.rowIndex]?.[
            coordinates.tileIndex
          ]?.sides[neighbor.oppositeSide]
        if (!adjacent) continue
        required[neighbor.side] = adjacent
        hasNeighbor = true
      }

      if (!isGridEmpty && !hasNeighbor) continue
      cells.push({
        rowIndex: place.rowIndex,
        tileIndex: place.tileIndex,
        required,
      })
    }

    return cells
  }

  /** Состояние русла на момент розыгрыша: считается один раз. */
  private collectRiverState(): RiverState {
    const placedRiverTiles = Object.values(this.state.tilePlacesStats).reduce(
      (count, row) =>
        count +
        Object.values(row).filter(
          (placedTile) => placedTile.riverGroups?.length
        ).length,
      0
    )
    return {
      hasRiverEnd: this.hasRiverEnd(),
      openEnds: this.findOpenRiverEnds(),
      placedRiverTiles,
    }
  }

  /** Тайл подходит клетке, если каждая его сторона совпадает с требованием. */
  private matchesCell(tile: Tile, cell: PlacementCell): boolean {
    return NEIGHBOR_SIDES.every((neighbor) => {
      const required = cell.required[neighbor.side]
      return required === undefined || required === tile.sides[neighbor.side]
    })
  }

  /**
   * Проверка размещения по посчитанным требованиям: стороны тайла должны
   * совпасть с соседями, а правила реки — выполняться.
   */
  private isTilePlacementValid(
    tile: Tile,
    cell: PlacementCell,
    river: RiverState
  ): boolean {
    const riverEnabled = this.state.rules.expansions.river

    if (riverEnabled && tile.expansion === ExpansionName.River) {
      // Речной тайл ставится по правилам русла: стороны соседей его не касаются.
      return this.checkRiverPlacementWithState(
        tile,
        cell.rowIndex,
        cell.tileIndex,
        river
      )
    }

    if (
      riverEnabled &&
      !this.checkRiverPlacementWithState(
        tile,
        cell.rowIndex,
        cell.tileIndex,
        river
      )
    ) {
      return false
    }

    return this.matchesCell(tile, cell)
  }

  private getValidTileRotation(
    tile: Tile,
    cells: PlacementCell[],
    river: RiverState
  ): Tile | undefined {
    for (const cell of cells) {
      for (const rotationCount of [0, 1, 2, 3]) {
        let processedTile: Tile = { ...tile }
        for (let index = 0; index < rotationCount; index += 1) {
          processedTile = this.state.rotateTile(processedTile)
        }

        if (!this.isTilePlacementValid(processedTile, cell, river)) continue

        return processedTile
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

  /**
   * Проверка правил реки по заранее посчитанному состоянию русла: открытые
   * концы и стоящие речные тайлы не пересчитываются для каждой проверки.
   */
  private checkRiverPlacementWithState(
    tile: Tile,
    rowIndex: number,
    tileIndex: number,
    river: RiverState
  ): boolean {
    if (this.isPlacingStartTile()) {
      const center = boardCenterCoordinates(this.state.gridSize)
      return (
        tile.id === TileId.RIVER_A &&
        rowIndex === center.rowIndex &&
        tileIndex === center.tileIndex
      )
    }
    if (tile.id === TileId.RIVER_A) return false
    if (river.hasRiverEnd) return !tile.riverGroups?.length
    if (!tile.riverGroups?.length) return false

    const riverSides = tile.riverGroups.flat()
    if (tile.riverGroups.length !== 1) return false
    if (!river.placedRiverTiles) return false
    if (riverSides.length < 1 || riverSides.length > 2) return false

    // Русло должно продолжить ровно один открытый конец среди уже стоящих
    // тайлов и не открывать новых: у открытого конца и у выхода нового тайла
    // должны совпасть клетка и сторона.
    const openEnd = river.openEnds[0]
    if (river.openEnds.length !== 1 || !openEnd) return false

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
      connection.rowIndex !== openEnd.rowIndex ||
      connection.tileIndex !== openEnd.tileIndex ||
      openEnd.side !== OPPOSITE_SIDE[connection.side]
    ) {
      return false
    }
    if (!riverSides.includes(connection.side)) return false
    const exitSide = riverSides.find((side) => side !== connection.side)
    if (exitSide === SideName.North) return false

    return tile.id === TileId.RIVER_L
      ? riverSides.length === 1
      : riverSides.length === 2
  }

  private checkRiverPlacement(
    tile: Tile,
    rowIndex: number,
    tileIndex: number
  ): { valid: boolean; conflict?: RiverPlacementConflict } {
    if (this.isPlacingStartTile()) {
      const center = boardCenterCoordinates(this.state.gridSize)
      return {
        valid:
          tile.id === TileId.RIVER_A &&
          rowIndex === center.rowIndex &&
          tileIndex === center.tileIndex,
      }
    }
    if (tile.id === TileId.RIVER_A) return { valid: false }
    if (this.hasRiverEnd()) return { valid: !tile.riverGroups?.length }
    if (!tile.riverGroups?.length) return { valid: false }

    const riverSides = tile.riverGroups.flat()
    if (tile.riverGroups.length !== 1) return { valid: false }

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
    const openEnd = openEnds[0]
    if (openEnds.length !== 1 || !openEnd) return { valid: false }

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
