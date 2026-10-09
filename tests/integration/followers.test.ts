import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  assertFollowerInvariants,
  chooseFollowerPlace,
  createLobbyWithSingleHuman,
  driveTurnsUntilFollowerOffer,
  makeHumanMove,
  playerId,
  startGame,
  waitForHumanTurnOrEnd,
  type GameStateSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'
import {
  FollowerType,
  SideName,
  SocketEvents,
  TileId,
  TileSideType,
  type Tile,
} from '@server/modules/types'

/** Монастырь без сторон-объектов: у него доступна только клетка-центр. */
function monasteryTile(): Tile {
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

describe('Размещение фишек', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  afterEach(async () => {
    for (const client of clients) client.dispose()
    clients.length = 0
    if (server) {
      await stopTestServer(server)
      server = undefined
    }
  })

  it('фишка размещается на объекте и списывается из запаса игрока', async () => {
    server = await startTestServer()
    const { gameId, creator, aliceId } = await createLobbyWithSingleHuman(
      server.url
    )
    clients.push(creator)

    await startGame(creator, gameId)

    const { preState, offerGame } = await driveTurnsUntilFollowerOffer(
      creator,
      gameId,
      aliceId
    )
    expect(offerGame).not.toBeNull()
    expect(preState).not.toBeNull()

    const beforeOrdinary =
      preState!.playersFollowers![playerId(aliceId)]!.ordinaryFollowers
    const offeredPlaces = offerGame!.availableFollowersPlaces!
    const place = chooseFollowerPlace(offeredPlaces)

    const placed = await creator.emitAck<{
      success: boolean
      game: GameStateSnapshot
    }>(SocketEvents.PlaceFollower, {
      gameId,
      place,
      followerType: place.temporaryObject.isGarden
        ? FollowerType.Abbot
        : FollowerType.Follower,
    })

    const afterGame = placed.game
    const afterKey = playerId(aliceId)

    // Фишка списана из запаса
    expect(afterGame.playersFollowers![afterKey]!.ordinaryFollowers).toBe(
      beforeOrdinary - 1
    )

    // Фишка появилась на доске с нужным objectId
    const follower = afterGame.placedFollowers!.find(
      (f) =>
        playerId(f.playerId) === afterKey &&
        f.objectId === place.temporaryObject.id
    )
    expect(follower).toBeTruthy()
    expect(follower!.point).toMatchObject(place.point)

    // Объект на временном объекте получил подданного игрока
    const allObjects = [
      ...(afterGame.temporaryObjects?.roads ?? []),
      ...(afterGame.temporaryObjects?.cities ?? []),
      ...(afterGame.temporaryObjects?.monasteries ?? []),
      ...(afterGame.temporaryObjects?.gardens ?? []),
    ]
    const targetObject = allObjects.find(
      (object) => object.id === place.temporaryObject.id
    )
    expect(targetObject).toBeTruthy()
    expect(targetObject!.followers).toContainEqual(
      expect.objectContaining({ playerId: aliceId })
    )

    // Инвариант запаса не нарушен
    assertFollowerInvariants(afterGame)
  })

  it('пропуск размещения фишки завершает ход без списания из запаса', async () => {
    server = await startTestServer()
    const { gameId, creator, aliceId } = await createLobbyWithSingleHuman(
      server.url
    )
    clients.push(creator)

    await startGame(creator, gameId)

    const { offerGame } = await driveTurnsUntilFollowerOffer(
      creator,
      gameId,
      aliceId
    )
    if (!offerGame) return

    expect(offerGame.isPlacingFollower).toBe(true)
    expect(offerGame.availableFollowersPlaces!.length).toBeGreaterThan(0)
    // Каждый предложенный объект не содержит фишек до нашего хода
    for (const place of offerGame.availableFollowersPlaces!) {
      expect(place.temporaryObject.followers).toHaveLength(0)
    }

    const before =
      offerGame.playersFollowers![playerId(aliceId)]!.ordinaryFollowers

    const skipped = await creator.emitAck<{
      success: boolean
      game: GameStateSnapshot
    }>(SocketEvents.SkipFollower, { gameId })

    const afterGame = skipped.game
    expect(afterGame.isPlacingFollower).toBe(false)
    // Ход ушёл, фишка из запаса не списана
    expect(
      afterGame.playersFollowers![playerId(aliceId)]!.ordinaryFollowers
    ).toBe(before)

    assertFollowerInvariants(afterGame)
  })

  it('ход завершается, когда обычные подданные исчерпаны и доступен только центр', async () => {
    server = await startTestServer()
    const { gameId, creator, aliceId } = await createLobbyWithSingleHuman(
      server.url
    )
    clients.push(creator)

    let state = await startGame(creator, gameId)

    const running = server
    if (!running) throw new Error('Сервер не запущен')
    const liveGame = running.handle.gameService.getGame(gameId)
    if (!liveGame) throw new Error('Партия не найдена')

    // Обычные подданные Алисы исчерпаны, аббат всё ещё в запасе, а тайл —
    // монастырь без сторон-объектов: сервер предложит только клетку-центр.
    liveGame.playersFollowers[String(aliceId)].ordinaryFollowers = 0
    liveGame.currentTile = { ...monasteryTile(), x: 15, y: 16 }
    running.handle.io
      .to(gameId)
      .emit(
        SocketEvents.GameUpdated,
        running.handle.gameService.formatGameData(liveGame)
      )

    state = await waitForHumanTurnOrEnd(creator, aliceId, {
      initialState: state,
    })
    expect(state.currentTile?.id).toBe(TileId.B)

    const { game, placedFollower } = await makeHumanMove(creator, gameId, state)

    // Сервер принял ход вместо молчаливого пропуска и ошибки размещения
    expect(placedFollower?.temporaryObject.isMonastery).toBe(true)
    expect(game.playersFollowers?.[playerId(aliceId)]).toEqual({
      ordinaryFollowers: 0,
      monks: 0,
    })
    expect(
      (game.placedFollowers ?? []).some(
        (follower) =>
          playerId(follower.playerId) === playerId(aliceId) && follower.isAbbot
      )
    ).toBe(true)
  })
})
