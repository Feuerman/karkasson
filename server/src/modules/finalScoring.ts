/**
 * Финальный подсчёт очков по незавершённым объектам.
 *
 * Вызывается один раз в конце партии, если включено правило финального
 * подсчёта. Дороги и города считаются незавершёнными (0 очков за дорогу с
 * таверной и за незавершённый город с собором, 1 очко за тайл в остальных
 * случаях), монастыри и сады — по окружающим занятым клеткам. Очки
 * начисляются лидерам объекта и записываются в историю отдельной записью с
 * отметкой `isFinalScoring`.
 */

import type { ScoringBoard } from './boardState'
import {
  CENTRAL_OBJECT_NAMES,
  countCenterObjectPoints,
  describeCentralObjectPoints,
  distributeScore,
} from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  type BaseObject,
  type ScoreDetails,
  type ScoreForObject,
} from './types'

/** Виды объектов, которые считаются при финальном подсчёте. */
type FinalScoringCollection = 'roads' | 'cities' | 'monasteries' | 'gardens'

/**
 * Описание вида объекта для финального подсчёта: куда он переносится, каким
 * типом отмечается в истории и как считаются его очки.
 */
interface FinalScoringKind {
  collection: FinalScoringCollection
  objectType: ObjectTypes
  /** Очки объекта и их детализация. */
  count(
    state: ScoringBoard,
    object: BaseObject
  ): { score: ScoreForObject; details: ScoreDetails }
}

const FINAL_SCORING_KINDS: FinalScoringKind[] = [
  {
    collection: 'roads',
    objectType: ObjectTypes.ROAD,
    count: (state, object) => ({
      score: state.calcScoreForRoad(object, false),
      details: state.describeScoreForRoad(object, false),
    }),
  },
  {
    collection: 'cities',
    objectType: ObjectTypes.CITY,
    count: (state, object) => ({
      score: state.calcScoreForCity(object, false),
      details: state.describeScoreForCity(object, false),
    }),
  },
  {
    collection: 'monasteries',
    objectType: ObjectTypes.MONASTERY,
    count: (state, object) => {
      const points = countCenterObjectPoints(state.tilePlacesStats, object)
      return {
        score: distributeScore(points, object.followers, state.scores),
        details: describeCentralObjectPoints(
          points,
          CENTRAL_OBJECT_NAMES[ObjectTypes.MONASTERY]
        ),
      }
    },
  },
  {
    collection: 'gardens',
    objectType: ObjectTypes.GARDEN,
    count: (state, object) => {
      const points = countCenterObjectPoints(state.tilePlacesStats, object)
      return {
        score: distributeScore(points, object.followers, state.scores),
        details: describeCentralObjectPoints(
          points,
          CENTRAL_OBJECT_NAMES[ObjectTypes.GARDEN]
        ),
      }
    },
  },
]

/**
 * Начисляет очки по незавершённым объектам и переносит их в завершённые.
 * Аббаты на уже завершённых объектах считаются отдельно: они остаются на
 * поле до конца партии и получают очки за окружение.
 */
export function finalizeScoring(state: ScoringBoard): void {
  const completedMonasteries = [...state.completedObjects.monasteries]
  const completedGardens = [...state.completedObjects.gardens]

  for (const kind of FINAL_SCORING_KINDS) {
    const unfinished = state.temporaryObjects[kind.collection]
    state.temporaryObjects[kind.collection] = []

    for (const object of unfinished) {
      const { score, details } = kind.count(state, object)
      recordFinalObjectScore(state, object, score, kind.objectType, details)
      state.completedObjects[kind.collection].push({
        ...structuredClone(object),
        score,
      })
    }
  }

  scoreRemainingAbbots(state, completedMonasteries, ObjectTypes.MONASTERY)
  scoreRemainingAbbots(state, completedGardens, ObjectTypes.GARDEN)
}

/** Аббаты на завершённых объектах получают очки за окружение один раз. */
function scoreRemainingAbbots(
  state: ScoringBoard,
  objects: BaseObject[],
  kind: ObjectTypes.MONASTERY | ObjectTypes.GARDEN
) {
  for (const object of objects) {
    const abbots = object.followers.filter((follower) => follower.isAbbot)
    if (!abbots.length) continue

    const points = countCenterObjectPoints(state.tilePlacesStats, object)
    const score = distributeScore(points, abbots, state.scores)
    object.score = score
    recordFinalObjectScore(
      state,
      { ...object, followers: abbots },
      score,
      kind,
      describeCentralObjectPoints(points, CENTRAL_OBJECT_NAMES[kind])
    )
  }
}

/** Запись в историю о финальном начислении; объекты без подданных не пишутся. */
function recordFinalObjectScore(
  state: ScoringBoard,
  object: BaseObject,
  score: ScoreForObject,
  objectType: ObjectTypes,
  { details, modifiers }: ScoreDetails
) {
  if (!object.followers.length) return
  state.recordAction({
    actionType: ActionTypes.ADDING_SCORES,
    actionData: {
      objectType,
      objectData: structuredClone(object),
      score,
      details,
      modifiers,
      isFinalScoring: true,
    },
  })
}
