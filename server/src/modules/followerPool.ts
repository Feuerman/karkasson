/**
 * Запас подданных игрока и снятие фишки с поля.
 *
 * Списание, возврат и снятие фишки делались в трёх местах — у менеджера
 * подданных, у менеджера объектов и у менеджера дракона с принцессой, — и
 * ветки аббата и большого подданного в них разошлись. Здесь один контракт
 * на все три операции, поэтому расхождение больше невозможно.
 */

import { isSameFollowerPoint } from './followerMatching'
import {
  FollowerType as FollowerTypes,
  ObjectTypes,
  type CompletedObjects,
  type FollowerCount,
  type FollowerType,
  type ObjectFollower,
  type PlacedFollower,
  type TemporaryObjects,
} from './types'

/** Пары «коллекция объектов — тип объекта» для снятия подданного с поля. */
const FOLLOWER_COLLECTIONS: ReadonlyArray<
  readonly [keyof TemporaryObjects, ObjectTypes]
> = [
  ['cities', ObjectTypes.CITY],
  ['roads', ObjectTypes.ROAD],
  ['monasteries', ObjectTypes.MONASTERY],
  ['gardens', ObjectTypes.GARDEN],
]

/** Тип фишки по её признакам: аббат хранится в запасе как монах. */
export function followerTypeOf(
  follower: Pick<ObjectFollower, 'isAbbot' | 'isBigFollower'>
): FollowerType {
  if (follower.isAbbot) return FollowerTypes.Abbot
  if (follower.isBigFollower) return FollowerTypes.BigFollower
  return FollowerTypes.Follower
}

/** Списание фишки из запаса игрока. */
export function takeFollower(
  pool: FollowerCount,
  followerType: FollowerType
): void {
  if (followerType === FollowerTypes.Abbot) {
    pool.monks -= 1
    return
  }
  if (followerType === FollowerTypes.BigFollower) {
    if (pool.bigFollowers !== undefined) pool.bigFollowers -= 1
    return
  }
  pool.ordinaryFollowers -= 1
}

/**
 * Возврат фишки в запас игрока. Большой подданный возвращается всегда:
 * потерять фишку из-за выключенного дополнения нельзя.
 */
export function returnFollower(
  pool: FollowerCount,
  followerType: FollowerType
): void {
  if (followerType === FollowerTypes.Abbot) {
    pool.monks += 1
    return
  }
  if (followerType === FollowerTypes.BigFollower) {
    pool.bigFollowers = (pool.bigFollowers ?? 0) + 1
    return
  }
  pool.ordinaryFollowers += 1
}

/** Доска, с которой снимают фишку. */
export interface FollowerBoardState {
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  placedFollowers: PlacedFollower[]
}

/**
 * Снимает фишку с поля: убирает её с объекта и из списка выставленных.
 * Возвращает вид объекта, с которого снята фишка.
 */
export function removeFollowerFromObject(
  state: FollowerBoardState,
  follower: ObjectFollower
): ObjectTypes | undefined {
  const objectType = detachFollowerFromObjects(state, follower)
  removePlacedFollower(state, follower)
  return objectType
}

/**
 * Убирает фишку из списка выставленных, но оставляет её на объекте.
 *
 * Так снимаются фишки завершившегося строения: очки уже начислены, фишка
 * вернулась в запас, но объект остаётся с теми же фишками — по ним проверяется
 * начисленный счёт.
 */
export function removePlacedFollower(
  state: FollowerBoardState,
  follower: ObjectFollower
): void {
  const index = state.placedFollowers.findIndex((placed) =>
    isSameFollowerPoint(placed, follower)
  )
  if (index >= 0) state.placedFollowers.splice(index, 1)
}

/** Убирает фишку с объектов доски и возвращает вид объекта, с которого снята. */
function detachFollowerFromObjects(
  state: FollowerBoardState,
  follower: ObjectFollower
): ObjectTypes | undefined {
  let objectType: ObjectTypes | undefined
  for (const [collection, type] of FOLLOWER_COLLECTIONS) {
    for (const objects of [
      state.temporaryObjects[collection],
      state.completedObjects[collection],
    ]) {
      const object = objects.find(({ id }) => id === follower.objectId)
      if (!object) continue
      objectType ??= type
      object.followers = object.followers.filter(
        (placed) => !isSameFollowerPoint(placed, follower)
      )
    }
  }
  return objectType
}
