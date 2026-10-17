import { SideName, TileId, TileSideType } from '@server/modules/types'
import type {
  Tile,
  TileSideType as TileSideTypeType,
  TileSides,
} from '@server/modules/types'

/** Карта сторон тайла в порядке север, восток, юг, запад. */
export function sides(
  north: TileSideTypeType,
  east: TileSideTypeType,
  south: TileSideTypeType,
  west: TileSideTypeType
): TileSides {
  return {
    [SideName.North]: north,
    [SideName.East]: east,
    [SideName.South]: south,
    [SideName.West]: west,
  }
}

/** Карта сторон тайла: все стороны — поле. */
export const FIELD_SIDES: TileSides = sides(
  TileSideType.Field,
  TileSideType.Field,
  TileSideType.Field,
  TileSideType.Field
)

/** Монастырь без сторон-объектов: доступна только клетка-центр. */
export function monasteryTile(): Tile {
  return {
    id: TileId.B,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_B.png',
    rotation: 0,
    sides: FIELD_SIDES,
    isMonastery: true,
  }
}

/** Монастырь с дорогой на южной стороне. */
export function monasteryWithRoadTile(): Tile {
  return {
    id: TileId.A,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_A.png',
    rotation: 0,
    sides: sides(
      TileSideType.Field,
      TileSideType.Field,
      TileSideType.Road,
      TileSideType.Field
    ),
    isMonastery: true,
  }
}
