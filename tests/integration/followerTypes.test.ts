import { describe, expect, it } from 'vitest'
import { GameManager } from '@server/modules/GameManager'
import { FollowerType, TileId, TileSideType } from '@server/modules/types'
import type { Tile } from '@server/modules/types'
import { makePlayers } from '../helpers/fixtures'
import { monasteryTile, monasteryWithRoadTile, sides } from '../helpers/tiles'
import {
  makeEmptyGame,
  placeCenterTile,
  usePlayerAsCurrent,
} from '../helpers/board'

/**
 * Список допустимых фишек — это правило, а не оформление: клиент рисует кнопки
 * по этому списку, а сервер проверяет по нему же постановку. Поэтому проверки
 * идут на живом GameManager и сверяют оба применения одного правила.
 */

function gardenTile(): Pick<Tile, 'id' | 'sides'> & Partial<Tile> {
  return {
    id: TileId.I,
    imgUrl: '/src/assets/tiles/Base_Game_C3_Tile_I.png',
    sides: sides(
      TileSideType.City,
      TileSideType.Field,
      TileSideType.Field,
      TileSideType.City
    ),
    hasGarden: true,
  }
}

/**
 * Партия с одним садом в центре: тайл кладётся на доску напрямую, поэтому
 * проверка не зависит от того, какие дороги и города есть у соседей.
 */
function makeGardenGame(
  params: { innsAndCathedralsEnabled?: boolean } = {}
): GameManager {
  const game = makeEmptyGame(params)
  const tile = placeCenterTile(game, gardenTile())
  usePlayerAsCurrent(game, 0)
  game.currentTile = tile
  game.checkAvailableFollowers()
  return game
}

function makeGame(
  tile: Tile,
  row: number,
  col: number,
  params: { innsAndCathedralsEnabled?: boolean } = {}
): GameManager {
  const game = new GameManager({
    players: makePlayers(),
    ...params,
  })
  // Колода нужна, чтобы endTurn не спотыкался о пустой список тайлов.
  game.tilesList = [tile]
  game.currentTile = { ...tile, x: col, y: row }
  game.placeTile(game.currentTile, row, col)
  return game
}

function placeBy(
  game: GameManager,
  predicate: (place: {
    temporaryObject: { isMonastery?: boolean; isGarden?: boolean }
    point: { pointType?: string }
  }) => boolean
) {
  const place = game.availableFollowersPlaces.find((item) => predicate(item))
  if (!place) throw new Error('Ожидалось доступное место')
  return place
}

const isRoad = (place: { point: { pointType?: string } }) =>
  place.point.pointType === TileSideType.Road
const isMonastery = (place: { temporaryObject: { isMonastery?: boolean } }) =>
  Boolean(place.temporaryObject.isMonastery)
const isGarden = (place: { temporaryObject: { isGarden?: boolean } }) =>
  Boolean(place.temporaryObject.isGarden)

describe('Допустимые типы фишек в доступных местах', () => {
  it.each([
    {
      name: 'на дороге без дополнения',
      make: () => makeGame(monasteryWithRoadTile(), 16, 15),
      place: isRoad,
      expected: [FollowerType.Follower],
    },
    {
      name: 'на дороге с дополнением «Таверны и соборы»',
      make: () =>
        makeGame(monasteryWithRoadTile(), 16, 15, {
          innsAndCathedralsEnabled: true,
        }),
      place: isRoad,
      expected: [FollowerType.Follower, FollowerType.BigFollower],
    },
    {
      name: 'в монастыре без дополнения',
      make: () => makeGame(monasteryTile(), 16, 15),
      place: isMonastery,
      expected: [FollowerType.Follower, FollowerType.Abbot],
    },
    {
      name: 'в монастыре с дополнением «Таверны и соборы»',
      make: () =>
        makeGame(monasteryTile(), 16, 15, {
          innsAndCathedralsEnabled: true,
        }),
      place: isMonastery,
      expected: [
        FollowerType.Follower,
        FollowerType.BigFollower,
        FollowerType.Abbot,
      ],
    },
    {
      name: 'в саду без дополнения',
      make: () => makeGardenGame(),
      place: isGarden,
      expected: [FollowerType.Abbot],
    },
    {
      name: 'в саду с дополнением «Таверны и соборы»',
      make: () => makeGardenGame({ innsAndCathedralsEnabled: true }),
      place: isGarden,
      expected: [FollowerType.Abbot],
    },
  ])('предлагает $expected $name', ({ make, place, expected }) => {
    const game = make()

    expect(game.getAvailableFollowerTypes(placeBy(game, place))).toEqual(
      expected
    )
  })

  it('не предлагает фишек, которых не осталось в запасе', () => {
    const game = makeGame(monasteryWithRoadTile(), 16, 15)
    const roadPlace = placeBy(game, isRoad)
    const monasteryPlace = placeBy(game, isMonastery)

    game.playersFollowers[1].ordinaryFollowers = 0
    game.playersFollowers[1].monks = 0

    expect(game.getAvailableFollowerTypes(roadPlace)).toEqual([])
    expect(game.getAvailableFollowerTypes(monasteryPlace)).toEqual([])
  })

  it('место не предлагается игроку, у которого не осталось фишек', () => {
    const game = new GameManager({ players: makePlayers() })
    game.playersFollowers[1] = { ordinaryFollowers: 0, monks: 0 }
    game.tilesList = [monasteryTile()]
    game.currentTile = { ...monasteryTile(), x: 15, y: 16 }

    expect(game.placeTile(game.currentTile, 16, 15)).toBe(true)
    expect(game.availableFollowersPlaces).toEqual([])
    expect(game.isPlacingFollower).toBe(false)
  })

  it.each([
    {
      name: 'дороги',
      make: () => makeGame(monasteryWithRoadTile(), 16, 15),
      place: isRoad,
    },
    {
      name: 'монастыря',
      make: () => makeGame(monasteryTile(), 16, 15),
      place: isMonastery,
    },
    { name: 'сада', make: () => makeGardenGame(), place: isGarden },
  ])(
    'сервер принимает ровно те типы фишек, которые объявил в списке ($name)',
    ({ make, place }) => {
      const game = make()
      game.rules.expansions.innsAndCathedrals = true
      game.playersFollowers[1].bigFollowers = 1
      const target = placeBy(game, place)
      const offered = game.getAvailableFollowerTypes(target)
      const allTypes = [
        FollowerType.Follower,
        FollowerType.BigFollower,
        FollowerType.Abbot,
      ]

      allTypes.forEach((followerType) => {
        const accepted = game.simulatePlaceFollower(target, followerType)
        expect(accepted, `${target.temporaryObject.id}: ${followerType}`).toBe(
          offered.includes(followerType)
        )
        if (!accepted) return
        // Пробный ход откатывается, поэтому следующий тип проверяется заново.
        target.temporaryObject.followers.length = 0
        game.placedFollowers.length = 0
        game.playersFollowers[1] = {
          ordinaryFollowers: 7,
          bigFollowers: 1,
          monks: 1,
        }
      })
    }
  )
})
