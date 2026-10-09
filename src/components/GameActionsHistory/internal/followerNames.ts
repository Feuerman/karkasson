import { FollowerType, ObjectTypes, TileSideType } from '@server/modules/types'
import type {
  AvailableFollowerPlace,
  ReturnedFollower,
} from '@server/modules/types'

/** Маркер большого подданного в истории: он удваивает очки за объект. */
export const BIG_FOLLOWER_MARK = '*'

/** Подсказка к маркеру большого подданного. */
export const BIG_FOLLOWER_HINT = `${BIG_FOLLOWER_MARK} — большой подданный`

/**
 * Наименования подданных по объекту, на котором они были выставлены:
 * разбойник — на дороге, рыцарь — в городе, монах — в монастыре, аббат —
 * в монастыре или саду. Размер фишки на наименование не влияет: большой
 * подданный отмечается маркером.
 */
const FOLLOWER_NAMES: Record<ObjectTypes, string> = {
  [ObjectTypes.ROAD]: 'разбойник',
  [ObjectTypes.CITY]: 'рыцарь',
  [ObjectTypes.MONASTERY]: 'монах',
  [ObjectTypes.GARDEN]: 'аббат',
}

/** Признаки фишки, достаточные для наименования в истории. */
export interface NamedFollower {
  objectType?: ObjectTypes
  isAbbot?: boolean
  isBigFollower?: boolean
}

/** Наименование подданного с маркером большого. */
export const namedFollower = (follower: NamedFollower): string => {
  const name = baseFollowerName(follower)
  return follower.isBigFollower ? `${name}${BIG_FOLLOWER_MARK}` : name
}

const baseFollowerName = (follower: NamedFollower): string => {
  // Аббат выставляется в монастырь или сад, но называется аббатом в обоих
  // случаях.
  if (follower.isAbbot) return FOLLOWER_NAMES[ObjectTypes.GARDEN]
  if (follower.objectType) {
    return FOLLOWER_NAMES[follower.objectType]
  }
  // Сохранения старых версий хранят фишку без типа объекта.
  return 'подданный'
}

/** Тип объекта, на котором стоит подданный в записи о выставлении. */
const placeObjectType = (
  place: AvailableFollowerPlace
): ObjectTypes | undefined => {
  if (place.temporaryObject.isGarden) return ObjectTypes.GARDEN
  if (place.temporaryObject.isMonastery) return ObjectTypes.MONASTERY
  if (place.point.pointType === TileSideType.Road) return ObjectTypes.ROAD
  if (place.point.pointType === TileSideType.City) return ObjectTypes.CITY
  return undefined
}

/**
 * Наименование подданного из записи истории о выставлении: тип фишки известен
 * явно, объект определяется по месту выставления.
 */
export const placedFollowerName = (place: {
  point: AvailableFollowerPlace['point']
  temporaryObject: AvailableFollowerPlace['temporaryObject']
  followerType?: FollowerType
}): string =>
  namedFollower({
    objectType: placeObjectType(place),
    isAbbot: place.followerType === FollowerType.Abbot,
    isBigFollower: place.followerType === FollowerType.BigFollower,
  })

/** Наименование подданного из записи истории о возврате. */
export const followerName = (follower: ReturnedFollower): string =>
  namedFollower(follower)

/** Есть ли среди подданных большой: нужно показать подсказку к маркеру. */
export const hasBigFollower = (followers: ReturnedFollower[]): boolean =>
  followers.some((follower) => follower.isBigFollower)

/** Сгруппированные по игроку наименования подданных из записи истории. */
export interface NamedFollowersByPlayer {
  playerId: string
  names: string[]
}

/**
 * Перечисляет подданных по игрокам: каждому игроку соответствует список
 * наименований возвращённых фишек в порядке их возврата.
 */
export const groupFollowerNamesByPlayer = (
  followers: ReturnedFollower[]
): NamedFollowersByPlayer[] => {
  const groups = new Map<string, string[]>()
  for (const follower of followers) {
    const playerId = String(follower.playerId)
    const names = groups.get(playerId)
    if (names) {
      names.push(followerName(follower))
    } else {
      groups.set(playerId, [followerName(follower)])
    }
  }
  return [...groups].map(([playerId, names]) => ({ playerId, names }))
}
