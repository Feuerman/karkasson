import { afterEach, describe, expect, it } from 'vitest'
import { TestClient } from './helpers/client'
import {
  assertFollowerInvariants,
  chooseFollowerPlace,
  createLobbyWithSingleHuman,
  driveTurnsUntilFollowerOffer,
  playerId,
  startGame,
  type GameStateSnapshot,
} from './helpers/gameplay'
import {
  startTestServer,
  stopTestServer,
  type RunningServer,
} from './helpers/server'

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
    }>('placeFollower', {
      gameId,
      place,
      followerType: place.temporaryObject.isGarden ? 'abbot' : 'follower',
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
    }>('skipFollower', { gameId })

    const afterGame = skipped.game
    expect(afterGame.isPlacingFollower).toBe(false)
    // Ход ушёл, фишка из запаса не списана
    expect(
      afterGame.playersFollowers![playerId(aliceId)]!.ordinaryFollowers
    ).toBe(before)

    assertFollowerInvariants(afterGame)
  })
})
