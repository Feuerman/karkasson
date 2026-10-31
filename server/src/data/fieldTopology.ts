/**
 * Shared types and helpers for tile-local field topology.
 *
 * Each physical side has two half-edge ports, one near each corner. A field
 * region lists the ports reached by the same uninterrupted area inside a tile.
 * City references are indexes into that tile's cityGroups.
 */

import { SideName, type SideName as SideNameType } from '../modules/types'

export const FIELD_BOUNDARY_PORTS = [
  'northWest',
  'northEast',
  'eastNorth',
  'eastSouth',
  'southEast',
  'southWest',
  'westSouth',
  'westNorth',
] as const

export type FieldBoundaryPort = (typeof FIELD_BOUNDARY_PORTS)[number]

export interface FieldRegionDefinition {
  /** Boundary half-edges reached by this continuous local field area. */
  boundaryPorts: FieldBoundaryPort[]
  /** City group indexes directly touching this area inside the tile. */
  adjacentCityGroups: number[]
}

export type TileFieldTopology = FieldRegionDefinition[]

type DuplicateItems<
  Items extends readonly unknown[],
  Seen = never,
  Duplicates = never,
> = Items extends readonly [infer Item, ...infer Remaining]
  ? DuplicateItems<Remaining, Seen | Item, Duplicates | Extract<Item, Seen>>
  : Duplicates

type NoDuplicateItems<Items extends readonly unknown[]> = [
  DuplicateItems<Items>,
] extends [never]
  ? unknown
  : {
      readonly __fieldTopologyError__: 'Duplicate item'
      readonly item: DuplicateItems<Items>
    }

type DuplicatePorts<
  Regions extends readonly FieldRegionDefinition[],
  SeenPorts = never,
  Duplicates = never,
> = Regions extends readonly [
  infer Region extends FieldRegionDefinition,
  ...infer Remaining extends FieldRegionDefinition[],
]
  ? DuplicatePorts<
      Remaining,
      SeenPorts | Region['boundaryPorts'][number],
      Duplicates | Extract<Region['boundaryPorts'][number], SeenPorts>
    >
  : Duplicates

type NoDuplicatePorts<Regions extends readonly FieldRegionDefinition[]> = [
  DuplicatePorts<Regions>,
] extends [never]
  ? unknown
  : {
      readonly __fieldTopologyError__: 'Duplicate boundary port'
      readonly port: DuplicatePorts<Regions>
    }

/** Builds one connected field region for a tile definition. */
export function field<const Ports extends FieldBoundaryPort[]>(
  boundaryPorts: Ports & NoDuplicateItems<Ports>,
  adjacentCityGroups: number[] = []
): FieldRegionDefinition & { boundaryPorts: Ports } {
  if (boundaryPorts.length === 0) {
    throw new Error('A field must have at least one boundary port')
  }

  const seenPorts = new Set<string>()
  for (const port of boundaryPorts) {
    if (!FIELD_BOUNDARY_PORTS.includes(port)) {
      throw new Error(`Field has invalid boundary port: ${port}`)
    }
    if (seenPorts.has(port)) {
      throw new Error(`Field has duplicate boundary port: ${port}`)
    }
    seenPorts.add(port)
  }

  const seenCityGroups = new Set<number>()
  for (const cityGroup of adjacentCityGroups) {
    if (!Number.isInteger(cityGroup) || cityGroup < 0) {
      throw new Error(`Field has invalid city group index: ${cityGroup}`)
    }
    if (seenCityGroups.has(cityGroup)) {
      throw new Error(`Field has duplicate city group index: ${cityGroup}`)
    }
    seenCityGroups.add(cityGroup)
  }

  return { boundaryPorts, adjacentCityGroups }
}

export const fields = <const Regions extends readonly FieldRegionDefinition[]>(
  ...regions: Regions & NoDuplicatePorts<Regions>
): TileFieldTopology => {
  const seenPorts = new Set<FieldBoundaryPort>()
  const duplicatePorts = new Set<FieldBoundaryPort>()

  regions.forEach((region) => {
    for (const port of region.boundaryPorts) {
      if (seenPorts.has(port)) {
        duplicatePorts.add(port)
      }
      seenPorts.add(port)
    }
  })

  if (duplicatePorts.size > 0) {
    throw new Error(
      `Boundary ports occur in multiple fields: ${[...duplicatePorts].join(', ')}`
    )
  }

  return [...regions]
}

export const wholeTileField = (
  adjacentCityGroups: number[] = []
): TileFieldTopology => [field([...FIELD_BOUNDARY_PORTS], adjacentCityGroups)]

/** Returns the physical side a half-edge port belongs to. */
export function sideOfFieldPort(port: FieldBoundaryPort): SideNameType {
  if (port.startsWith('north')) return SideName.North
  if (port.startsWith('east')) return SideName.East
  if (port.startsWith('south')) return SideName.South
  return SideName.West
}

/** Finds the matching half-edge on the neighboring tile across this edge. */
export function oppositeFieldPort(port: FieldBoundaryPort): FieldBoundaryPort {
  const opposite: Record<FieldBoundaryPort, FieldBoundaryPort> = {
    northWest: 'southWest',
    northEast: 'southEast',
    eastNorth: 'westNorth',
    eastSouth: 'westSouth',
    southEast: 'northEast',
    southWest: 'northWest',
    westSouth: 'eastSouth',
    westNorth: 'eastNorth',
  }
  return opposite[port]
}
