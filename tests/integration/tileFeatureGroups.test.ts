import { describe, expect, it } from 'vitest'
import tiles from '@server/data/tiles'
import { innsAndCathedralsTiles } from '@server/data/innsAndCathedralsTiles'
import { SideName, TileId, TileSideType } from '@server/modules/types'
import type { Tile } from '@server/modules/types'
import { makeEmptyGame, rotatedCopies } from '../helpers/board'

/**
 * Каталог тайлов — это данные, а не логика: ошибка в нём проявилась бы
 * только как неверный объект на доске. Поэтому группы связности проверяются
 * перебором всех тайлов, всех поворотов и обеих фич.
 */

const FEATURES = [TileSideType.Road, TileSideType.City] as const

type Feature = (typeof FEATURES)[number]

function sidesWithFeature(tile: Tile, feature: Feature): SideName[] {
  return (Object.keys(tile.sides) as SideName[]).filter(
    (side) => tile.sides[side] === feature
  )
}

/**
 * Группы обязаны покрывать ровно те стороны, на которых стоит фича, без
 * пропусков и повторов: иначе часть тайла не становится объектом или
 * превращается в два объекта вместо одного.
 */
function expectGroupsCoverFeature(
  game: ReturnType<typeof makeEmptyGame>,
  tile: Tile,
  feature: Feature,
  label: string
): void {
  const expected = sidesWithFeature(tile, feature)
  const groups = game.getTileFeatureGroups(tile, feature).flat()

  expect([...groups].sort(), label).toEqual([...expected].sort())
  expect(new Set(groups).size, `${label}: стороны без повторов`).toBe(
    groups.length
  )
}

/** Проверяет каталог всех фич и всех поворотов указанного набора тайлов */
function expectGroupsValidForAllRotations(
  game: ReturnType<typeof makeEmptyGame>,
  catalog: readonly (Omit<Tile, 'rotation'> & { rotation?: number })[]
): void {
  for (const definition of catalog) {
    for (const feature of FEATURES) {
      for (const rotated of rotatedCopies(game, definition)) {
        expectGroupsCoverFeature(
          game,
          rotated,
          feature,
          `${definition.id} ${feature} at ${rotated.rotation} degrees`
        )
      }
    }
  }
}

/**
 * Обещанные каталогом группы обязаны стоять на сторонах своей фичи, а герб —
 * защищать одну из групп города того же тайла.
 */
function expectDeclaredGroupsFitFeatures(tile: Tile): void {
  const roadSides = sidesWithFeature(tile, TileSideType.Road)
  const citySides = sidesWithFeature(tile, TileSideType.City)
  const declared: Array<[string, SideName[][], SideName[]]> = [
    [TileSideType.Road, tile.roadGroups ?? [], roadSides],
    [TileSideType.City, tile.cityGroups ?? [], citySides],
    ['shield', tile.cityShieldGroups ?? [], citySides],
  ]

  for (const [feature, groups, validSides] of declared) {
    for (const group of groups) {
      expect(
        group.every((side) => validSides.includes(side)),
        `${tile.id} ${feature} group ${group.join(',')}`
      ).toBe(true)
    }
  }

  for (const shieldGroup of tile.cityShieldGroups ?? []) {
    expect(
      (tile.cityGroups ?? []).some((cityGroup) =>
        shieldGroup.every((side) => cityGroup.includes(side))
      ),
      `${tile.id} shield ${shieldGroup.join(',')}`
    ).toBe(true)
  }
}

describe('Группы связности базовых тайлов', () => {
  it('нормализует стороны каждого каталожного тайла в группы без пропусков и дублей', () => {
    expectGroupsValidForAllRotations(makeEmptyGame(), tiles)
  })

  it('оставляет каждую ветвь дороги отдельной группой', () => {
    const game = makeEmptyGame()

    for (const definition of tiles) {
      for (const rotated of rotatedCopies(game, definition)) {
        const roadSides = sidesWithFeature(rotated, TileSideType.Road)
        if (roadSides.length < 3) continue

        expect(
          game
            .getTileFeatureGroups(rotated, TileSideType.Road)
            .every((group) => group.length === 1),
          `${definition.id}: ветви дороги не слились`
        ).toBe(true)
      }
    }
  })
})

describe('Группы связности тайлов дополнения «Таверны и соборы»', () => {
  it('покрывает стороны и группы каждого тайла дополнения', () => {
    expectGroupsValidForAllRotations(
      makeEmptyGame({ innsAndCathedralsEnabled: true }),
      innsAndCathedralsTiles
    )
  })

  it('проверяет ожидаемую топологию дорог и городов всех тайлов дополнения', () => {
    const game = makeEmptyGame({ innsAndCathedralsEnabled: true })
    const expectedGroups: Partial<
      Record<TileId, { road: string[][]; city: string[][] }>
    > = {
      [TileId.IAC_A]: { road: [[SideName.South, SideName.West]], city: [] },
      [TileId.IAC_B]: { road: [[SideName.East, SideName.West]], city: [] },
      [TileId.IAC_C]: {
        road: [[SideName.East], [SideName.South], [SideName.West]],
        city: [],
      },
      [TileId.IAC_D]: { road: [[SideName.East], [SideName.West]], city: [] },
      [TileId.IAC_E]: {
        road: [
          [SideName.North, SideName.West],
          [SideName.East, SideName.South],
        ],
        city: [],
      },
      [TileId.IAC_F]: {
        road: [[SideName.East]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_G]: { road: [], city: [[SideName.West]] },
      [TileId.IAC_H]: {
        road: [],
        city: [
          [SideName.North],
          [SideName.East],
          [SideName.South],
          [SideName.West],
        ],
      },
      [TileId.IAC_I]: {
        road: [[SideName.East], [SideName.West]],
        city: [[SideName.North], [SideName.South]],
      },
      [TileId.IAC_J]: { road: [[SideName.South]], city: [[SideName.North]] },
      [TileId.IAC_Ka]: {
        road: [],
        city: [[SideName.North, SideName.East, SideName.South, SideName.West]],
      },
      [TileId.IAC_Kb]: {
        road: [],
        city: [[SideName.North, SideName.East, SideName.South, SideName.West]],
      },
      [TileId.IAC_L]: {
        road: [[SideName.East, SideName.South]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_M]: {
        road: [[SideName.South, SideName.West]],
        city: [[SideName.North]],
      },
      [TileId.IAC_N]: {
        road: [[SideName.South]],
        city: [[SideName.North, SideName.West]],
      },
      [TileId.IAC_O]: {
        road: [],
        city: [[SideName.North], [SideName.East], [SideName.West]],
      },
      [TileId.IAC_P]: {
        road: [],
        city: [[SideName.North, SideName.West], [SideName.South]],
      },
      [TileId.IAC_Q]: {
        road: [[SideName.North], [SideName.South]],
        city: [[SideName.East, SideName.West]],
      },
    }

    expect(Object.keys(expectedGroups).sort()).toEqual(
      innsAndCathedralsTiles.map(({ id }) => id).sort()
    )
    for (const definition of innsAndCathedralsTiles) {
      const start: Tile = { ...definition, rotation: 0 }
      for (const feature of FEATURES) {
        expect(
          game.getTileFeatureGroups(start, feature),
          `${definition.id} ${feature}`
        ).toEqual(expectedGroups[definition.id]?.[feature])
      }

      expectDeclaredGroupsFitFeatures(start)
    }
  })

  it('поворачивает группы дорог дополнения вместе с тайлом', () => {
    const game = makeEmptyGame({ innsAndCathedralsEnabled: true })
    const definition = innsAndCathedralsTiles.find(
      (tile) => tile.id === TileId.IAC_E
    )
    if (!definition) throw new Error(`Tile ${TileId.IAC_E} is missing`)
    const start: Tile = { ...definition, rotation: 0 }

    expect(
      game.getTileFeatureGroups(game.rotateTile(start), TileSideType.Road)
    ).toEqual([
      [SideName.East, SideName.North],
      [SideName.South, SideName.West],
    ])
  })
})
