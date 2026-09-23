import type { TileSideType } from '@server/modules/types'

export const tiles: {
  id: string
  count: number
  description: string
  sides: {
    north: TileSideType
    east: TileSideType
    south: TileSideType
    west: TileSideType
  }
  isMonastery?: boolean
  withShield?: boolean
  isSolidCity?: boolean
  imgUrl: string
}[] = [
  {
    id: 'A',
    count: 2,
    description: 'Monastery with road',
    sides: {
      north: 'field',
      east: 'field',
      south: 'road',
      west: 'field',
    },
    isMonastery: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_A.png',
  },
  {
    id: 'B',
    count: 4,
    description: 'Monastery',
    sides: {
      north: 'field',
      east: 'field',
      south: 'field',
      west: 'field',
    },
    isMonastery: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_B.png',
  },
  {
    id: 'C',
    count: 1,
    description: 'City with shield',
    sides: {
      north: 'city',
      east: 'city',
      south: 'city',
      west: 'city',
    },
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_C.png',
  },
  {
    id: 'D',
    count: 4,
    description: 'City with road',
    sides: {
      north: 'city',
      east: 'road',
      south: 'field',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_D.png',
  },
  {
    id: 'E',
    count: 5,
    description: 'City',
    sides: {
      north: 'city',
      east: 'field',
      south: 'field',
      west: 'field',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_E.png',
  },
  {
    id: 'F',
    count: 2,
    description: 'Two city edges with shield',
    sides: {
      north: 'field',
      east: 'city',
      south: 'field',
      west: 'city',
    },
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_F.png',
  },
  {
    id: 'G',
    count: 1,
    description: 'Two city edges',
    sides: {
      north: 'field',
      east: 'city',
      south: 'field',
      west: 'city',
    },
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_G.png',
  },
  {
    id: 'H',
    count: 3,
    description: 'Two city edges',
    sides: {
      north: 'city',
      east: 'field',
      south: 'city',
      west: 'field',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_H.png',
  },
  {
    id: 'I',
    count: 2,
    description: 'Two adjacent city edges',
    sides: {
      north: 'city',
      east: 'field',
      south: 'field',
      west: 'city',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_I.png',
  },
  {
    id: 'J',
    count: 3,
    description: 'City with curved road',
    sides: {
      north: 'city',
      east: 'road',
      south: 'road',
      west: 'field',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_J.png',
  },
  {
    id: 'K',
    count: 3,
    description: 'City with road',
    sides: {
      north: 'city',
      east: 'field',
      south: 'road',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_K.png',
  },
  {
    id: 'L',
    count: 3,
    description: 'City with crossroads',
    sides: {
      north: 'city',
      east: 'road',
      south: 'road',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_L.png',
  },
  {
    id: 'M',
    count: 2,
    description: 'Two city edges with shield',
    sides: {
      north: 'city',
      east: 'field',
      south: 'city',
      west: 'field',
    },
    withShield: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_M.png',
  },
  {
    id: 'N',
    count: 3,
    description: 'City with road',
    sides: {
      north: 'city',
      east: 'field',
      south: 'road',
      west: 'field',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_N.png',
  },
  {
    id: 'O',
    count: 2,
    description: 'City and road with shield',
    sides: {
      north: 'city',
      east: 'road',
      south: 'road',
      west: 'city',
    },
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_O.png',
  },
  {
    id: 'P',
    count: 3,
    description: 'City and road',
    sides: {
      north: 'city',
      east: 'road',
      south: 'road',
      west: 'city',
    },
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_P.png',
  },
  {
    id: 'Q',
    count: 1,
    description: 'City with shield',
    sides: {
      north: 'city',
      east: 'city',
      south: 'field',
      west: 'city',
    },
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_Q.png',
  },
  {
    id: 'R',
    count: 3,
    description: 'City',
    sides: {
      north: 'city',
      east: 'city',
      south: 'field',
      west: 'city',
    },
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_R.png',
  },
  {
    id: 'S',
    count: 2,
    description: 'City with road and shield',
    sides: {
      north: 'city',
      east: 'city',
      south: 'road',
      west: 'city',
    },
    withShield: true,
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_S.png',
  },
  {
    id: 'T',
    count: 1,
    description: 'City with road',
    sides: {
      north: 'city',
      east: 'city',
      south: 'road',
      west: 'city',
    },
    isSolidCity: true,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_T.png',
  },
  {
    id: 'U',
    count: 8,
    description: 'Straight road',
    sides: {
      north: 'road',
      east: 'field',
      south: 'road',
      west: 'field',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_U.png',
  },
  {
    id: 'V',
    count: 9,
    description: 'Curved road',
    sides: {
      north: 'field',
      east: 'field',
      south: 'road',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_V.png',
  },
  {
    id: 'W',
    count: 4,
    description: 'T-junction road',
    sides: {
      north: 'field',
      east: 'road',
      south: 'road',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_W.png',
  },
  {
    id: 'X',
    count: 1,
    description: 'Crossroads',
    sides: {
      north: 'road',
      east: 'road',
      south: 'road',
      west: 'road',
    },
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_X.png',
  },
]

export default tiles
