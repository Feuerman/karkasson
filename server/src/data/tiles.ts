import {
  ExpansionName,
  SideName,
  TileId,
  TileSideType,
  type TileSides,
} from '../modules/types'

export interface TileDefinition {
  id: TileId
  count: number
  description: string
  sides: TileSides
  isMonastery?: boolean
  withShield?: boolean
  isSolidCity?: boolean
  hasInn?: boolean
  hasCathedral?: boolean
  roadGroups?: SideName[][]
  cityGroups?: SideName[][]
  /** City sections on this tile that contain a shield. */
  cityShieldGroups?: SideName[][]
  expansion?: typeof ExpansionName.InnsAndCathedrals
  imgUrl: string
}

export const tiles: TileDefinition[] = [
  {
    id: TileId.A,
    count: 2,
    description: 'Monastery with road',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    isMonastery: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_A.png',
  },
  {
    id: TileId.B,
    count: 4,
    description: 'Monastery',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    isMonastery: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_B.png',
  },
  {
    id: TileId.C,
    count: 1,
    description: 'City with shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [
      [SideName.North, SideName.East, SideName.South, SideName.West],
    ],
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_C.png',
  },
  {
    id: TileId.D,
    count: 4,
    description: 'City with road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East], [SideName.West]],
    cityGroups: [[SideName.North]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_D.png',
  },
  {
    id: TileId.E,
    count: 5,
    description: 'City',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_E.png',
  },
  {
    id: TileId.F,
    count: 2,
    description: 'Two city edges with shield',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.East, SideName.West]],
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_F.png',
  },
  {
    id: TileId.G,
    count: 1,
    description: 'Two city edges',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.East, SideName.West]],
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_G.png',
  },
  {
    id: TileId.H,
    count: 3,
    description: 'Two city edges',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.City,
      [SideName.West]: TileSideType.Field,
    },
    cityGroups: [[SideName.North], [SideName.South]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_H.png',
  },
  {
    id: TileId.I,
    count: 2,
    description: 'Two adjacent city edges',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.West]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_I.png',
  },
  {
    id: TileId.J,
    count: 3,
    description: 'City with curved road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.East, SideName.South]],
    cityGroups: [[SideName.North]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_J.png',
  },
  {
    id: TileId.K,
    count: 3,
    description: 'City with road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    cityGroups: [[SideName.North]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_K.png',
  },
  {
    id: TileId.L,
    count: 3,
    description: 'City with crossroads',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East, SideName.South, SideName.West]],
    cityGroups: [[SideName.North]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_L.png',
  },
  {
    id: TileId.M,
    count: 2,
    description: 'Two city edges with shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    cityGroups: [[SideName.North, SideName.East]],
    withShield: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_M.png',
  },
  {
    id: TileId.N,
    count: 3,
    description: 'City with road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    cityGroups: [[SideName.North, SideName.East]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_N.png',
  },
  {
    id: TileId.O,
    count: 2,
    description: 'City and road with shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    roadGroups: [[SideName.East, SideName.South]],
    cityGroups: [[SideName.North, SideName.West]],
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_O.png',
  },
  {
    id: TileId.P,
    count: 3,
    description: 'City and road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    roadGroups: [[SideName.East, SideName.South]],
    cityGroups: [[SideName.North, SideName.West]],
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_P.png',
  },
  {
    id: TileId.Q,
    count: 1,
    description: 'City with shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_Q.png',
  },
  {
    id: TileId.R,
    count: 3,
    description: 'City',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_R.png',
  },
  {
    id: TileId.S,
    count: 2,
    description: 'City with road and shield',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_S.png',
  },
  {
    id: TileId.T,
    count: 1,
    description: 'City with road',
    sides: {
      [SideName.North]: TileSideType.City,
      [SideName.East]: TileSideType.City,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.City,
    },
    cityGroups: [[SideName.North, SideName.East, SideName.West]],
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_T.png',
  },
  {
    id: TileId.U,
    count: 8,
    description: 'Straight road',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    roadGroups: [[SideName.North, SideName.South]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_U.png',
  },
  {
    id: TileId.V,
    count: 9,
    description: 'Curved road',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.South, SideName.West]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_V.png',
  },
  {
    id: TileId.W,
    count: 4,
    description: 'T-junction road',
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [[SideName.East, SideName.South, SideName.West]],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_W.png',
  },
  {
    id: TileId.X,
    count: 1,
    description: 'Crossroads',
    sides: {
      [SideName.North]: TileSideType.Road,
      [SideName.East]: TileSideType.Road,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Road,
    },
    roadGroups: [
      [SideName.North, SideName.East, SideName.South, SideName.West],
    ],
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_X.png',
  },
]

/** Число копий тайла с садом (по id тайла), отмечаемых при генерации колоды. */
export const gardenTileCounts: Record<string, number> = {
  I: 1,
  R: 1,
  U: 1,
  V: 1,
  E: 1,
  H: 1,
  M: 1,
  N: 1,
}

export default tiles
