import { describe, expect, it } from 'vitest'
import {
  followerTypeOf,
  removeFollowerFromObject,
  removePlacedFollower,
  returnFollower,
  takeFollower,
} from '@server/modules/followerPool'
import {
  FollowerType as FollowerTypes,
  ObjectTypes,
  type BaseObject,
  type FollowerCount,
  type PlacedFollower,
} from '@server/modules/types'

const pool = (overrides: Partial<FollowerCount> = {}): FollowerCount => ({
  ordinaryFollowers: 7,
  monks: 1,
  ...overrides,
})

describe('followerTypeOf', () => {
  it('определяет тип фишки по её признакам', () => {
    expect(followerTypeOf({})).toBe(FollowerTypes.Follower)
    expect(followerTypeOf({ isBigFollower: true })).toBe(
      FollowerTypes.BigFollower
    )
    expect(followerTypeOf({ isAbbot: true })).toBe(FollowerTypes.Abbot)
  })
})

describe('takeFollower', () => {
  it('списывает обычного подданного', () => {
    const followers = pool()
    takeFollower(followers, FollowerTypes.Follower)
    expect(followers.ordinaryFollowers).toBe(6)
  })

  it('списывает аббата из запаса монахов', () => {
    const followers = pool()
    takeFollower(followers, FollowerTypes.Abbot)
    expect(followers.monks).toBe(0)
    expect(followers.ordinaryFollowers).toBe(7)
  })

  it('списывает большого подданного', () => {
    const followers = pool({ bigFollowers: 1 })
    takeFollower(followers, FollowerTypes.BigFollower)
    expect(followers.bigFollowers).toBe(0)
  })

  it('не создаёт большого подданного, если дополнение выключено', () => {
    const followers = pool()
    takeFollower(followers, FollowerTypes.BigFollower)
    expect(followers.bigFollowers).toBeUndefined()
  })
})

describe('returnFollower', () => {
  it('возвращает обычного подданного', () => {
    const followers = pool({ ordinaryFollowers: 3 })
    returnFollower(followers, FollowerTypes.Follower)
    expect(followers.ordinaryFollowers).toBe(4)
  })

  it('возвращает аббата в запас монахов', () => {
    const followers = pool({ monks: 0 })
    returnFollower(followers, FollowerTypes.Abbot)
    expect(followers.monks).toBe(1)
  })

  it('возвращает большого подданного даже без дополнения', () => {
    const followers = pool()
    returnFollower(followers, FollowerTypes.BigFollower)
    expect(followers.bigFollowers).toBe(1)
  })
})

const follower = (overrides: Partial<PlacedFollower> = {}): PlacedFollower => ({
  playerId: 1,
  objectId: 'object-1',
  point: { x: 1, y: 2, direction: 'north' },
  ...overrides,
})

function boardState(followers: PlacedFollower[], objects: BaseObject[] = []) {
  return {
    temporaryObjects: {
      cities: objects,
      roads: [],
      monasteries: [],
      gardens: [],
    },
    completedObjects: {
      cities: [],
      roads: [],
      monasteries: [],
      gardens: [],
    },
    placedFollowers: followers,
  }
}

describe('removeFollowerFromObject', () => {
  it('убирает фишку с объекта и из списка выставленных', () => {
    const placed = follower()
    const object: BaseObject = {
      id: 'object-1',
      points: [{ x: 1, y: 2 }],
      followers: [{ playerId: 1, objectId: 'object-1', point: placed.point }],
    }
    const state = boardState([placed], [object])

    const objectType = removeFollowerFromObject(state, placed)

    expect(objectType).toBe(ObjectTypes.CITY)
    expect(object.followers).toHaveLength(0)
    expect(state.placedFollowers).toHaveLength(0)
  })

  it('возвращает undefined, если объект не найден', () => {
    const state = boardState([follower()])
    expect(removeFollowerFromObject(state, follower())).toBeUndefined()
  })
})

describe('removePlacedFollower', () => {
  it('убирает фишку из списка выставленных, но оставляет её на объекте', () => {
    const placed = follower()
    const object: BaseObject = {
      id: 'object-1',
      points: [{ x: 1, y: 2 }],
      followers: [{ playerId: 1, objectId: 'object-1', point: placed.point }],
    }
    const state = boardState([placed], [object])

    removePlacedFollower(state, placed)

    expect(state.placedFollowers).toHaveLength(0)
    expect(object.followers).toHaveLength(1)
  })
})
