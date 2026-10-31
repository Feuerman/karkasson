import type { TileDefinition } from './tiles'
import { ExpansionName, SideName, TileId, TileSideType } from '../modules/types'
import { field, fields } from './fieldTopology'

const image = (id: string) =>
  `/src/assets/tiles/inns_and_cardinals/Inns_And_Cathedrals_C3_Tile_${id}.png`

/** C3 tiles for the optional Inns and Cathedrals expansion. */
export const innsAndCathedralsTiles: TileDefinition[] = [
  {
    id: TileId.IAC_A,
    count: 1,
    description: 'Curved road with inn',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    hasInn: true,
    fieldTopology: fields(
      field([
        'eastNorth',
        'northEast',
        'northWest',
        'westNorth',
        'eastSouth',
        'southEast',
      ]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('A'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_B,
    count: 1,
    hasGarden: true,
    description: 'Straight road with inn',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East, SideName.West]],
    hasInn: true,
    fieldTopology: fields(
      field(['northWest', 'northEast', 'westNorth', 'eastNorth']),
      field(['westSouth', 'southWest', 'eastSouth', 'southEast'])
    ),
    imgUrl: image('B'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_C,
    count: 1,
    description: 'Three-way junction with inn',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    hasInn: true,
    fieldTopology: fields(
      field(['northWest', 'westNorth', 'northEast', 'eastNorth']),
      field(['eastSouth', 'southEast']),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('C'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_D,
    count: 1,
    description: 'Monastery',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East], [SideName.West]],
    isMonastery: true,
    fieldTopology: fields(
      field(['northWest', 'northEast', 'eastNorth', 'westNorth']),
      field(['southEast', 'southWest', 'eastSouth', 'westSouth'])
    ),
    imgUrl: image('D'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_E,
    count: 1,
    description: 'Two separate curved roads',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [
      [SideName.North, SideName.West],
      [SideName.East, SideName.South],
    ],
    fieldTopology: fields(
      field(['eastSouth', 'southEast']),
      field(['westNorth', 'northWest']),
      field(['southWest', 'westSouth', 'northEast', 'eastNorth'])
    ),
    imgUrl: image('E'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_F,
    count: 1,
    description: 'City with road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    roadGroups: [[SideName.East]],
    fieldTopology: fields(
      field(['eastNorth'], [0]),
      field(['southWest', 'southEast', 'eastSouth'], [0])
    ),
    imgUrl: image('F'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_G,
    count: 1,
    description: 'City edge',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.West]],
    fieldTopology: fields(
      field(['northWest', 'northEast'], [0]),
      field(['eastNorth', 'eastSouth', 'southEast', 'southWest'], [0])
    ),
    imgUrl: image('G'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_H,
    count: 1,
    hasGarden: true,
    description: 'Opposite city edges',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [
      [SideName.North],
      [SideName.East],
      [SideName.South],
      [SideName.West],
    ],
    fieldTopology: [],
    imgUrl: image('H'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_I,
    count: 1,
    description: 'City with two roads',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.Road,
    },
    cityGroups: [[SideName.North], [SideName.South]],
    roadGroups: [[SideName.East], [SideName.West]],
    fieldTopology: fields(
      field(['westNorth'], [0]),
      field(['eastNorth'], [0]),
      field(['eastSouth'], [1]),
      field(['westSouth'], [1])
    ),
    imgUrl: image('I'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_J,
    count: 1,
    description: 'Curved road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    fieldTopology: fields(
      field(['westNorth', 'westSouth', 'southWest'], [0]),
      field(['eastNorth', 'eastSouth', 'southEast'], [0])
    ),
    imgUrl: image('J'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_Ka,
    count: 1,
    description: 'City with cathedral',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [
      [SideName.North, SideName.East, SideName.South, SideName.West],
    ],
    hasCathedral: true,
    fieldTopology: [],
    imgUrl: image('Ka'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_Kb,
    count: 1,
    description: 'City with cathedral and shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [
      [SideName.North, SideName.East, SideName.South, SideName.West],
    ],
    hasCathedral: true,
    fieldTopology: [],
    imgUrl: image('Kb'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_L,
    count: 1,
    description: 'City with shield and road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    roadGroups: [[SideName.East, SideName.South]],
    withShield: true,
    hasInn: true,
    fieldTopology: fields(
      field(['eastNorth', 'southWest'], [0]),
      field(['southEast', 'eastSouth'])
    ),
    imgUrl: image('L'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_M,
    count: 1,
    description: 'Curved road with inn',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    hasInn: true,
    fieldTopology: fields(
      field(['westNorth', 'eastNorth', 'eastSouth', 'southEast'], [0]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('M'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_N,
    count: 1,
    description: 'Curved road with inn',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    hasInn: true,
    fieldTopology: fields(
      field(['eastNorth', 'eastSouth', 'southEast'], [0]),
      field(['southWest'], [0])
    ),
    imgUrl: image('N'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_O,
    count: 1,
    description: 'Curved road with inn',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North], [SideName.East], [SideName.West]],
    fieldTopology: fields(field(['southWest', 'southEast'], [0, 1, 2])),
    imgUrl: image('O'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_P,
    count: 1,
    description: 'Two city sections, one with shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West], [SideName.South]],
    cityShieldGroups: [[SideName.North, SideName.West]],
    fieldTopology: fields(field(['eastNorth', 'eastSouth'], [0, 1])),
    imgUrl: image('P'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
  {
    id: TileId.IAC_Q,
    count: 1,
    description: 'City with shield',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.East, SideName.West]],
    withShield: true,
    fieldTopology: fields(
      field(['northWest'], [0]),
      field(['northEast'], [0]),
      field(['southEast'], [0]),
      field(['southWest'], [0])
    ),
    imgUrl: image('Q'),
    expansion: ExpansionName.InnsAndCathedrals,
  },
]
