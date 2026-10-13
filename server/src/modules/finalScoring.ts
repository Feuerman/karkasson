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

import type { NewGameAction } from './gameActions'
import {
  CENTRAL_OBJECT_NAMES,
  countCenterObjectPoints,
  describeCentralObjectPoints,
  distributeScore,
  type CentralObjectKind,
} from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  type BaseObject,
  type CompletedObjects,
  type ScoreDetails,
  type ScoreForObject,
  type Scores,
  type TemporaryObjects,
  type TilePlacesStats,
} from './types'

interface FinalScoringState {
  temporaryObjects: TemporaryObjects
  completedObjects: CompletedObjects
  tilePlacesStats: TilePlacesStats
  scores: Scores
  recordAction(action: NewGameAction): void
  calcScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreForObject
  describeScoreForRoad(road: BaseObject, isCompleted?: boolean): ScoreDetails
  calcScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreForObject
  describeScoreForCity(city: BaseObject, isCompleted?: boolean): ScoreDetails
}

/**
 * Начисляет очки по незавершённым объектам и переносит их в завершённые.
 * Аббаты на уже завершённых объектах считаются отдельно: они остаются на
 * поле до конца партии и получают очки за окружение.
 */
export function finalizeScoring(state: FinalScoringState): void {
  const completedMonasteries = [...state.completedObjects.monasteries]
  const completedGardens = [...state.completedObjects.gardens]

  const unfinishedRoads = state.temporaryObjects.roads
  const unfinishedCities = state.temporaryObjects.cities
  const unfinishedMonasteries = state.temporaryObjects.monasteries
  const unfinishedGardens = state.temporaryObjects.gardens
  state.temporaryObjects.roads = []
  state.temporaryObjects.cities = []
  state.temporaryObjects.monasteries = []
  state.temporaryObjects.gardens = []

  for (const road of unfinishedRoads) {
    const score = state.calcScoreForRoad(road, false)
    recordFinalObjectScore(
      state,
      road,
      score,
      ObjectTypes.ROAD,
      state.describeScoreForRoad(road, false)
    )
    state.completedObjects.roads.push({ ...structuredClone(road), score })
  }

  for (const city of unfinishedCities) {
    const score = state.calcScoreForCity(city, false)
    recordFinalObjectScore(
      state,
      city,
      score,
      ObjectTypes.CITY,
      state.describeScoreForCity(city, false)
    )
    state.completedObjects.cities.push({ ...structuredClone(city), score })
  }

  scoreCentralObjects(state, unfinishedMonasteries, ObjectTypes.MONASTERY)
  scoreCentralObjects(state, unfinishedGardens, ObjectTypes.GARDEN)

  scoreRemainingAbbots(state, completedMonasteries, ObjectTypes.MONASTERY)
  scoreRemainingAbbots(state, completedGardens, ObjectTypes.GARDEN)
}

function scoreCentralObjects(
  state: FinalScoringState,
  objects: BaseObject[],
  kind: CentralObjectKind
) {
  const collection = kind === ObjectTypes.MONASTERY ? 'monasteries' : 'gardens'

  for (const object of objects) {
    const points = countCenterObjectPoints(state.tilePlacesStats, object, kind)
    const score = distributeScore(points, object.followers, state.scores)
    recordFinalObjectScore(
      state,
      object,
      score,
      kind,
      describeCentralObjectPoints(points, CENTRAL_OBJECT_NAMES[kind])
    )
    state.completedObjects[collection].push({
      ...structuredClone(object),
      score,
    })
  }
}

/** Аббаты на завершённых объектах получают очки за окружение один раз. */
function scoreRemainingAbbots(
  state: FinalScoringState,
  objects: BaseObject[],
  kind: CentralObjectKind
) {
  for (const object of objects) {
    const abbots = object.followers.filter((follower) => follower.isAbbot)
    if (!abbots.length) continue

    const points = countCenterObjectPoints(state.tilePlacesStats, object, kind)
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
  state: FinalScoringState,
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
