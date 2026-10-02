import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import { ExpansionName, TileId, TileSideType } from '@server/modules/types'

describe('Тайлы дополнения «Принцесса и дракон»', () => {
  it('содержит полное определение для каждого изображения набора', () => {
    const assetsDirectory = fileURLToPath(
      new URL('../../src/assets/tiles/princess_and_dragon/', import.meta.url)
    )
    const imageFiles = readdirSync(assetsDirectory)
      .filter((fileName) => fileName.startsWith('Princess_And_Dragon_C2_Tile_'))
      .sort()
    const tileImages = princessAndDragonTiles
      .map(({ imgUrl }) => imgUrl.split('/').at(-1))
      .sort()

    expect(tileImages).toEqual(imageFiles)
    expect(new Set(princessAndDragonTiles.map(({ id }) => id)).size).toBe(
      princessAndDragonTiles.length
    )
    expect(
      princessAndDragonTiles.every(
        (tile) =>
          tile.count > 0 &&
          tile.description.trim().length > 0 &&
          tile.expansion === ExpansionName.PrincessAndDragon &&
          Object.values(tile.sides).length === 4 &&
          Object.values(tile.sides).every((side) =>
            Object.values(TileSideType).includes(side)
          )
      )
    ).toBe(true)

    expect(princessAndDragonTiles.map(({ id }) => id)).toEqual([
      TileId.PAD_A,
      TileId.PAD_B,
      TileId.PAD_C,
      TileId.PAD_D,
      TileId.PAD_E,
      TileId.PAD_F,
      TileId.PAD_G,
      TileId.PAD_H,
      TileId.PAD_I,
      TileId.PAD_J,
      TileId.PAD_K,
      TileId.PAD_L,
      TileId.PAD_M,
      TileId.PAD_N,
      TileId.PAD_O,
      TileId.PAD_P,
      TileId.PAD_Q,
      TileId.PAD_R,
      TileId.PAD_S,
      TileId.PAD_T,
      TileId.PAD_U,
      TileId.PAD_V,
      TileId.PAD_W,
      TileId.PAD_X,
      TileId.PAD_Y,
      TileId.PAD_Z,
      TileId.PAD_1,
      TileId.PAD_2,
      TileId.PAD_3,
    ])
  })
})
