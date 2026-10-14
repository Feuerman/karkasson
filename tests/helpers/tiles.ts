import { SideName, TileId, TileSideType } from '@server/modules/types'
import type { Tile } from '@server/modules/types'

/** Монастырь без сторон-объектов: доступна только клетка-центр. */
export function monasteryTile(): Tile {
  return {
    id: TileId.B,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_B.png',
    rotation: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Field,
      [SideName.West]: TileSideType.Field,
    },
    isMonastery: true,
  }
}

/** Монастырь с дорогой на южной стороне. */
export function monasteryWithRoadTile(): Tile {
  return {
    id: TileId.A,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_A.png',
    rotation: 0,
    sides: {
      [SideName.North]: TileSideType.Field,
      [SideName.East]: TileSideType.Field,
      [SideName.South]: TileSideType.Road,
      [SideName.West]: TileSideType.Field,
    },
    isMonastery: true,
  }
}
