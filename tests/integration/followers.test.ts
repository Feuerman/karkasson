import { describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import { registerIntegrationCleanup } from './helpers/cleanup'
import {
  assertFollowerInvariants,
  chooseFollowerPlace,
  driveTurnsUntilFollowerOffer,
  makeHumanMove,
  playerId,
  startGame,
  waitForHumanTurnOrEnd,
  type GameStateSnapshot,
} from './helpers/gameplay'
import { createLobbyWithSingleHuman } from './helpers/lobby'
import { startTestServer, type RunningServer } from './helpers/server'
import { monasteryTile } from '../helpers/tiles'
import {
  FollowerType,
  PointDirection,
  SocketEvents,
  TileId,
} from '@server/modules/types'

describe('Размещение фишек', () => {
  let server: RunningServer | undefined
  const clients: TestClient[] = []

  registerIntegrationCleanup({
    getServer: () => server,
    clearServer: () => {
      server = undefined
    },
    disposeClients: () => {
      for (const client of clients) client.dispose()
      clients.length = 0
    },
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
      preState!.playersFollowers![playerId(aliceId)].ordinaryFollowers
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
    expect(afterGame.playersFollowers![afterKey].ordinaryFollowers).toBe(
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
      offerGame.playersFollowers![playerId(aliceId)].ordinaryFollowers

    const skipped = await creator.emitAck<{
      success: boolean
      game: GameStateSnapshot
    }>(SocketEvents.SkipFollower, { gameId })

    const afterGame = skipped.game
    expect(afterGame.isPlacingFollower).toBe(false)
    // Ход ушёл, фишка из запаса не списана
    expect(
      afterGame.playersFollowers![playerId(aliceId)].ordinaryFollowers
    ).toBe(before)

    assertFollowerInvariants(afterGame)
  })

  it('клиенту приходят допустимые фишки и сведения об отзыве аббата', async () => {
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
    expect(offerGame).not.toBeNull()

    const places = offerGame!.availableFollowersPlaces ?? []
    expect(places.length).toBeGreaterThan(0)
    places.forEach((place) => {
      const objectId = place.temporaryObject.id
      const types = offerGame!.availableFollowerTypes?.[objectId]
      expect(types, `тип фишек для ${objectId}`).toBeDefined()
      expect(types!.length, `тип фишек для ${objectId}`).toBeGreaterThan(0)

      // Аббат не ставится на сторону тайла, в сад — только он.
      const isCenter = place.point.direction === PointDirection.Center
      expect(types!.includes(FollowerType.Abbot)).toBe(isCenter)
      expect(
        types!.includes(FollowerType.Follower),
        'в сад подданный не ставится'
      ).toBe(!place.temporaryObject.isGarden)
    })

    // Аббат Алисы ещё не на доске — отзывать нечего
    expect(offerGame!.abbotRecall).toBeNull()
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
    if (!liveGame) throw new Error('Партия не найдена в тесте')

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
