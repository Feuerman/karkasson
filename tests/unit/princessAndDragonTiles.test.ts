import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { princessAndDragonTiles } from '@server/data/princessAndDragonTiles'
import { ExpansionName, TileSideType } from '@server/modules/types'

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
  })
})
