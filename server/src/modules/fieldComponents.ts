import { type TilePlacesStats } from './types'
import { NEIGHBOR_SIDES, neighborCoordinates } from './gameGeometry'
import {
  type FieldBoundaryPort,
  oppositeFieldPort,
  sideOfFieldPort,
} from '../data/fieldTopology'

interface FieldRegionNode {
  rowIndex: number
  tileIndex: number
  regionIndex: number
}

export interface FieldComponent {
  id: string
  regions: FieldRegionNode[]
}

class UnionFind {
  private readonly parent = new Map<string, string>()

  add(key: string): void {
    if (!this.parent.has(key)) {
      this.parent.set(key, key)
    }
  }

  find(key: string): string {
    this.add(key)
    let root = key
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root) as string
    }
    let current = key
    while (this.parent.get(current) !== root) {
      const next = this.parent.get(current) as string
      this.parent.set(current, root)
      current = next
    }
    return root
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA)
    }
  }
}

/** Ключ узла поля: строка, колонка, индекс региона на тайле. */
export function nodeKey(
  rowIndex: number,
  tileIndex: number,
  regionIndex: number
): string {
  return `${rowIndex},${tileIndex},${regionIndex}`
}

/** Порт тайла как ключ для поиска региона: строка, колонка, порт. */
function portKey(
  rowIndex: number,
  tileIndex: number,
  port: FieldBoundaryPort
): string {
  return `${rowIndex},${tileIndex},${port}`
}

/**
 * Строит связные компоненты полей по поставленным тайлам.
 * Соединяет регионы только через общую границу между соседними тайлами.
 * Дороги и реки уже учтены в топологии тайла — поле не проходит через них.
 * Пересчитывается от доски при каждом вызове; производный индекс не хранится.
 */
export function buildFieldComponents(
  tilePlacesStats: TilePlacesStats
): FieldComponent[] {
  const uf = new UnionFind()
  const nodes: FieldRegionNode[] = []
  const portToRegion = new Map<string, string>()

  // Собираем узлы: каждый регион поля на каждом тайле.
  for (const [rowIndexStr, row] of Object.entries(tilePlacesStats)) {
    const rowIndex = Number(rowIndexStr)
    for (const [tileIndexStr, tile] of Object.entries(row)) {
      const tileIndex = Number(tileIndexStr)
      const topology = tile.fieldTopology
      if (!topology) continue

      for (
        let regionIndex = 0;
        regionIndex < topology.length;
        regionIndex += 1
      ) {
        const region = topology[regionIndex]
        const key = nodeKey(rowIndex, tileIndex, regionIndex)
        uf.add(key)
        nodes.push({ rowIndex, tileIndex, regionIndex })

        for (const port of region.boundaryPorts) {
          portToRegion.set(portKey(rowIndex, tileIndex, port), key)
        }
      }
    }
  }

  // Соединяем регионы через общие границы между соседними тайлами.
  for (const [rowIndexStr, row] of Object.entries(tilePlacesStats)) {
    const rowIndex = Number(rowIndexStr)
    for (const [tileIndexStr, tile] of Object.entries(row)) {
      const tileIndex = Number(tileIndexStr)
      const topology = tile.fieldTopology
      if (!topology) continue

      for (const neighbor of NEIGHBOR_SIDES) {
        const coords = neighborCoordinates(rowIndex, tileIndex, neighbor)
        const neighborTile =
          tilePlacesStats[coords.rowIndex]?.[coords.tileIndex]
        if (!neighborTile?.fieldTopology) continue

        // Порты на стороне текущего тайла, обращённой к соседу.
        for (
          let regionIndex = 0;
          regionIndex < topology.length;
          regionIndex += 1
        ) {
          const region = topology[regionIndex]
          for (const port of region.boundaryPorts) {
            if (sideOfFieldPort(port) !== neighbor.side) continue

            const oppositePort = oppositeFieldPort(port)
            const neighborRegionKey = portToRegion.get(
              portKey(coords.rowIndex, coords.tileIndex, oppositePort)
            )
            if (!neighborRegionKey) continue

            const currentKey = nodeKey(rowIndex, tileIndex, regionIndex)
            uf.union(currentKey, neighborRegionKey)
          }
        }
      }
    }
  }

  // Группируем узлы по корням Union-Find.
  const components = new Map<string, FieldRegionNode[]>()
  for (const node of nodes) {
    const key = nodeKey(node.rowIndex, node.tileIndex, node.regionIndex)
    const root = uf.find(key)
    const list = components.get(root) ?? []
    list.push(node)
    components.set(root, list)
  }

  return [...components.values()].map((regions, index) => ({
    id: `field-${index}`,
    regions,
  }))
}

/**
 * Сопоставляет каждый узел поля (строка, колонка, регион) с идентификатором
 * его связной компоненты. Используется для проверки занятости поля и подсчёта.
 */
export function fieldComponentIndex(
  tilePlacesStats: TilePlacesStats
): Map<string, string> {
  const components = buildFieldComponents(tilePlacesStats)
  const index = new Map<string, string>()
  for (const component of components) {
    for (const region of component.regions) {
      index.set(
        nodeKey(region.rowIndex, region.tileIndex, region.regionIndex),
        component.id
      )
    }
  }
  return index
}
