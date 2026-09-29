import { describe, expect, it } from 'vitest'
import type { IGameBoard } from '../../server/src/modules/GameManager'
import { calculateHeuristicScore } from '../../server/src/modules/GameSimulatorModule'
import type {
  BaseObject,
  ObjectFollower,
  Player,
} from '../../server/src/modules/types'

const currentPlayer: Player = {
  id: 1,
  name: 'Alice',
  color: 'coral',
  score: 0,
  socketId: 'socket-1',
  deviceId: 'device-1',
}

function follower(playerId: number, objectId: string): ObjectFollower {
  return { playerId, objectId, point: { x: 0, y: 0 } }
}

function gameState(
  overrides: Partial<
    Pick<IGameBoard, 'scores' | 'currentPlayer' | 'temporaryObjects' | 'rules'>
  > = {}
): Pick<IGameBoard, 'scores' | 'currentPlayer' | 'temporaryObjects' | 'rules'> {
  return {
    scores: { 1: 4, 2: 6 },
    currentPlayer,
    rules: {
      finalScoringEnabled: false,
      expansions: { innsAndCathedrals: false },
    },
    temporaryObjects: {
      cities: [],
      roads: [],
      monasteries: [],
      gardens: [],
    },
    ...overrides,
  }
}

function object(id: string, followers: ObjectFollower[]): BaseObject {
  return { id, points: [], followers }
}

describe('calculateHeuristicScore', () => {
  it('sums existing scores and weighted value of each owned object type', () => {
    const state = gameState({
      temporaryObjects: {
        cities: [object('city', [follower(1, 'city'), follower(2, 'rival')])],
        roads: [object('road', [follower(1, 'road')])],
        monasteries: [object('monastery', [follower(1, 'monastery')])],
        gardens: [object('garden', [follower(1, 'garden')])],
      },
    })

    expect(calculateHeuristicScore(state)).toBe(19)
  })

  it('counts owned followers and ignores other players', () => {
    const state = gameState({
      temporaryObjects: {
        cities: [
          object('city', [
            follower(1, 'merged-city-a'),
            follower(1, 'merged-city-a'),
            follower(1, 'merged-city-b'),
            follower(2, 'rival-city'),
          ]),
        ],
        roads: [],
        monasteries: [],
        gardens: [],
      },
    })

    expect(calculateHeuristicScore(state)).toBe(16)
  })

  it('returns accumulated scores when there is no current player', () => {
    const state = gameState({ currentPlayer: null })

    expect(calculateHeuristicScore(state)).toBe(10)
  })
})
