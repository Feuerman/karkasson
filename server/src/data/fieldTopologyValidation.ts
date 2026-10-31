import {
  SIDE_NAMES,
  TileSideType,
  type SideName as SideNameType,
  type TileSides,
} from '../modules/types'
import { FIELD_BOUNDARY_PORTS, type TileFieldTopology } from './fieldTopology'
import type { TileDefinition } from './tiles'

/** Validates a tile's local field regions and city-group references. */
export function validateFieldTopology(
  tile: { cityGroups?: SideNameType[][]; sides: TileSides },
  topology: TileFieldTopology
): string[] {
  const errors: string[] = []
  const seenPorts = new Set<string>()
  const cityGroups =
    tile.cityGroups ??
    SIDE_NAMES.filter((side) => tile.sides[side] === TileSideType.City).map(
      (side) => [side]
    )

  topology.forEach((region, regionIndex) => {
    if (region.boundaryPorts.length === 0) {
      errors.push(`field ${regionIndex} has no boundary ports`)
    }
    for (const port of region.boundaryPorts) {
      if (!FIELD_BOUNDARY_PORTS.includes(port)) {
        errors.push(`field ${regionIndex} has invalid port ${port}`)
      } else if (seenPorts.has(port)) {
        errors.push(`boundary port ${port} occurs in multiple fields`)
      }
      seenPorts.add(port)
    }
    for (const cityGroup of region.adjacentCityGroups) {
      if (
        !Number.isInteger(cityGroup) ||
        cityGroup < 0 ||
        cityGroup >= cityGroups.length
      ) {
        errors.push(
          `field ${regionIndex} references missing city group ${cityGroup}`
        )
      }
    }
  })

  return errors
}

export function validateTileTopologies(
  definitions: readonly TileDefinition[]
): string[] {
  const errors: string[] = []
  for (const tile of definitions) {
    errors.push(
      ...validateFieldTopology(tile, tile.fieldTopology).map(
        (error) => `${tile.id}: ${error}`
      )
    )
  }
  return errors
}
