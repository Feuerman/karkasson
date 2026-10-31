import type { TileDefinition } from './tiles'
import { ExpansionName, SideName, TileId, TileSideType } from '../modules/types'
import { field, fields, wholeTileField } from './fieldTopology'

const image = (id: string) =>
  `/src/assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_${id}.jpg`

/** C2 tiles for the optional Princess and Dragon expansion. */
export const princessAndDragonTiles: TileDefinition[] = [
  {
    id: TileId.PAD_A,
    count: 1,
    description: 'City with a curved road and the princess',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    roadGroups: [[SideName.East, SideName.South]],
    hasPrincess: true,
    fieldTopology: fields(
      field(['eastNorth', 'southWest'], [0]),
      field(['southEast', 'eastSouth'])
    ),
    imgUrl: image('A'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_B,
    count: 1,
    description: 'City with a shield and garden',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    withShield: true,
    hasPrincess: true,
    hasGarden: true,
    fieldTopology: fields(
      field(['eastNorth', 'eastSouth', 'southEast', 'southWest'], [0])
    ),
    imgUrl: image('B'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_C,
    count: 1,
    description: 'City with a princess',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    hasPrincess: true,
    fieldTopology: fields(field(['southWest', 'southEast'], [0])),
    imgUrl: image('C'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_D,
    count: 1,
    description: 'City and three-way road junction with a princess',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East], [SideName.South], [SideName.West]],
    hasPrincess: true,
    fieldTopology: fields(
      field(['westNorth', 'eastNorth'], [0]),
      field(['eastSouth', 'southEast']),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('D'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_E,
    count: 1,
    description: 'City with a princess',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    hasPrincess: true,
    fieldTopology: fields(
      field(['eastNorth', 'eastSouth'], [0]),
      field(['southWest', 'southEast'], [0])
    ),
    imgUrl: image('E'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_F,
    count: 1,
    description: 'Two separate city sections with a princess',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.Field,
    },
    cityGroups: [[SideName.North], [SideName.East, SideName.South]],
    hasPrincess: true,
    princessSide: SideName.North,
    fieldTopology: fields(field(['westNorth', 'westSouth'], [0])),
    imgUrl: image('F'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_G,
    count: 1,
    description: 'Curved road with a dragon',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.West, SideName.South]],
    hasDragon: true,
    fieldTopology: fields(
      field([
        'westNorth',
        'northWest',
        'northEast',
        'eastNorth',
        'eastSouth',
        'southEast',
      ]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('G'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_H,
    count: 1,
    description: 'Straight road with a dragon',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.North, SideName.South]],
    hasDragon: true,
    fieldTopology: fields(
      field(['westNorth', 'northWest', 'westSouth', 'southWest']),
      field(['northEast', 'eastNorth', 'eastSouth', 'southEast'])
    ),
    imgUrl: image('H'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_I,
    count: 1,
    description: 'Three-way road junction with a dragon',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East], [SideName.South], [SideName.West]],
    hasDragon: true,
    fieldTopology: fields(
      field(['northWest', 'westNorth', 'northEast', 'eastNorth']),
      field(['eastSouth', 'southEast']),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('I'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_J,
    count: 1,
    description: 'City with a garden and a dragon',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    hasGarden: true,
    hasDragon: true,
    fieldTopology: fields(
      field(
        [
          'eastNorth',
          'eastSouth',
          'southEast',
          'southWest',
          'westSouth',
          'westNorth',
        ],
        [0]
      )
    ),
    imgUrl: image('J'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_K,
    count: 1,
    description: 'City with a dragon',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    hasDragon: true,
    fieldTopology: fields(
      field(['eastNorth', 'eastSouth', 'southEast', 'southWest'], [0])
    ),
    imgUrl: image('K'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_L,
    count: 1,
    description: 'City and curved road with a dragon',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.West, SideName.South]],
    hasDragon: true,
    fieldTopology: fields(
      field(['eastNorth', 'westNorth', 'eastSouth', 'southEast'], [0]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('L'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_M,
    count: 1,
    description: 'City and curved road with a dragon',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.East, SideName.South]],
    hasDragon: true,
    fieldTopology: fields(
      field(['westNorth', 'eastNorth', 'westSouth', 'southWest'], [0]),
      field(['eastSouth', 'southEast'])
    ),
    imgUrl: image('M'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_N,
    count: 1,
    description: 'City with a shield and a dragon',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.East, SideName.West]],
    withShield: true,
    hasDragon: true,
    fieldTopology: fields(
      field(['northWest', 'northEast'], [0]),
      field(['southEast', 'southWest'], [0])
    ),
    imgUrl: image('N'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_O,
    count: 1,
    description: 'City with a monastery and a dragon',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    isMonastery: true,
    hasDragon: true,
    fieldTopology: fields(field(['southWest', 'southEast'], [0])),
    imgUrl: image('O'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_P,
    count: 1,
    description: 'Monastery, three-way road junction, and dragon',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East], [SideName.South], [SideName.West]],
    hasDragon: true,
    isMonastery: true,
    fieldTopology: fields(
      field(['northWest', 'westNorth', 'northEast', 'eastNorth']),
      field(['eastSouth', 'southEast']),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('P'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_Q,
    count: 1,
    description: 'City and straight road with a dragon',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    roadGroups: [[SideName.North, SideName.South]],
    cityGroups: [[SideName.East, SideName.West]],
    hasDragon: true,
    fieldTopology: fields(
      field(['northWest', 'northEast'], [0]),
      field(['southEast', 'southWest'], [0])
    ),
    imgUrl: image('Q'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_R,
    count: 1,
    description: 'Three-way road junction',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South], [SideName.West], [SideName.East]],
    fieldTopology: fields(
      field(['northWest', 'westNorth', 'northEast', 'eastNorth']),
      field(['eastSouth', 'southEast']),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('R'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_S,
    count: 1,
    description: 'City',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    fieldTopology: fields(field(['southWest', 'southEast'], [0])),
    imgUrl: image('S'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_T,
    count: 1,
    description: 'City with a curved road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    fieldTopology: fields(
      field(['westNorth', 'eastNorth', 'eastSouth', 'southEast'], [0]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('T'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_U,
    count: 1,
    description: 'City with a curved road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.South, SideName.East]],
    fieldTopology: fields(
      field(['westNorth', 'eastNorth', 'westSouth', 'southWest'], [0]),
      field(['eastSouth', 'southEast'])
    ),
    imgUrl: image('U'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_V,
    count: 1,
    description: 'City with a curved road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    roadGroups: [[SideName.East, SideName.South]],
    fieldTopology: fields(
      field(['eastNorth', 'southWest'], [0]),
      field(['eastSouth', 'southEast'])
    ),
    imgUrl: image('V'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_W,
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
      field(['northWest', 'westNorth']),
      field(['eastSouth', 'southEast']),
      field(['northEast', 'eastNorth', 'westSouth', 'southWest'])
    ),
    imgUrl: image('W'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_X,
    count: 1,
    description: 'Volcano with a curved road',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    hasVolcano: true,
    fieldTopology: fields(
      field([
        'northWest',
        'northEast',
        'eastNorth',
        'eastSouth',
        'southEast',
        'westNorth',
      ]),
      field(['southWest', 'westSouth'])
    ),
    imgUrl: image('X'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_Y,
    count: 1,
    description: 'Volcano with two separate city sections',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North], [SideName.West]],
    hasVolcano: true,
    fieldTopology: fields(
      field(['eastNorth', 'eastSouth', 'southEast', 'southWest'], [0, 1])
    ),
    imgUrl: image('Y'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_Z,
    count: 1,
    description: 'Volcano beside a city',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    hasVolcano: true,
    fieldTopology: fields(
      field(
        [
          'eastNorth',
          'eastSouth',
          'southEast',
          'southWest',
          'westSouth',
          'westNorth',
        ],
        [0]
      )
    ),
    imgUrl: image('Z'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_1,
    count: 1,
    description: 'Volcano with a road',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    hasVolcano: true,
    fieldTopology: wholeTileField(),
    imgUrl: image('1'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_2,
    count: 1,
    description: 'Volcano',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    hasVolcano: true,
    fieldTopology: wholeTileField(),
    imgUrl: image('2'),
    expansion: ExpansionName.PrincessAndDragon,
  },
  {
    id: TileId.PAD_3,
    count: 1,
    description: 'Volcano with a straight road',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.South, SideName.North]],
    hasVolcano: true,
    fieldTopology: fields(
      field(['northWest', 'westNorth', 'westSouth', 'southWest']),
      field(['northEast', 'eastNorth', 'eastSouth', 'southEast'])
    ),
    imgUrl: image('3'),
    expansion: ExpansionName.PrincessAndDragon,
  },
]
