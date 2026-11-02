/**
 * ��������� ������� ����� �� ������������� ��������.
 *
 * ���������� ���� ��� � ����� ������, ���� �������� ������� ����������
 * ��������. ������ � ������ ��������� �������������� (0 ����� �� ������ �
 * �������� � �� ������������� ����� � �������, 1 ���� �� ���� � ���������
 * �������), ��������� � ���� � �� ���������� ������� �������. ����
 * ����������� ������� ������� � ������������ � ������� ��������� ������� �
 * �������� `isFinalScoring`.
 */

import type { ScoringBoard } from './boardState'
import { buildFieldComponents } from './fieldComponents'
import { NEIGHBOR_SIDES, neighborCoordinates } from './gameGeometry'
import { sideOfFieldPort } from '../data/fieldTopology'
import {
  CENTRAL_OBJECT_NAMES,
  countCenterObjectPoints,
  describeCentralObjectPoints,
  distributeScore,
} from './scoring'
import {
  ActionTypes,
  ObjectTypes,
  TileSideType,
  type BaseObject,
  type FieldFollower,
  type PlayerId,
  type ScoreDetails,
  type ScoreForObject,
  type TilePlacesStats,
} from './types'

/** ���� ��������, ������� ��������� ��� ��������� ��������. */
type FinalScoringCollection = 'roads' | 'cities' | 'monasteries' | 'gardens'

/**
 * �������� ���� ������� ��� ���������� ��������: ���� �� �����������, �����
 * ����� ���������� � ������� � ��� ��������� ��� ����.
 */
interface FinalScoringKind {
  collection: FinalScoringCollection
  objectType: ObjectTypes
  /** ���� ������� � �� �����������. */
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
 * ��������� ���� �� ������������� �������� � ��������� �� � �����������.
 * ������ �� ��� ����������� �������� ��������� ��������: ��� �������� ��
 * ���� �� ����� ������ � �������� ���� �� ���������.
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

  scoreFields(state)

  scoreRemainingAbbots(state, completedMonasteries, ObjectTypes.MONASTERY)
  scoreRemainingAbbots(state, completedGardens, ObjectTypes.GARDEN)
}

/** ������ �� ����������� �������� �������� ���� �� ��������� ���� ���. */
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

/** ������ � ������� � ��������� ����������; ������� ��� ��������� �� �������. */
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

/** Индекс точек завершённых городов по «строка:колонка:сторона». */
function cityPointIndex(
  completedCities: BaseObject[]
): Map<string, BaseObject> {
  const index = new Map<string, BaseObject>()
  for (const city of completedCities) {
    for (const point of city.points) {
      if (point.direction) {
        index.set(`${point.y}:${point.x}:${point.direction}`, city)
      }
    }
  }
  return index
}

/** Уникальные завершённые города, соприкасающиеся с полем. */
function collectAdjacentCityIds(
  tilePlacesStats: TilePlacesStats,
  cityIndex: Map<string, BaseObject>,
  component: {
    id: string
    regions: Array<{ rowIndex: number; tileIndex: number; regionIndex: number }>
  }
): Set<string> {
  const cityIds = new Set<string>()

  for (const region of component.regions) {
    const tile = tilePlacesStats[region.rowIndex]?.[region.tileIndex]
    if (!tile) continue
    const topology = tile.fieldTopology
    if (!topology) continue
    const regionDef = topology[region.regionIndex]
    if (!regionDef) continue

    // Города на том же тайле, соприкасающиеся с регионом.
    for (const groupIndex of regionDef.adjacentCityGroups) {
      const group = tile.cityGroups?.[groupIndex]
      if (!group) continue
      for (const side of group) {
        const city = cityIndex.get(
          `${region.rowIndex}:${region.tileIndex}:${side}`
        )
        if (city) cityIds.add(city.id)
      }
    }

    // Города на соседних тайлах через граничные порты региона.
    for (const port of regionDef.boundaryPorts) {
      const side = sideOfFieldPort(port)
      const neighborDef = NEIGHBOR_SIDES.find((n) => n.side === side)
      if (!neighborDef) continue
      const coords = neighborCoordinates(
        region.rowIndex,
        region.tileIndex,
        neighborDef
      )
      const neighbor = tilePlacesStats[coords.rowIndex]?.[coords.tileIndex]
      if (!neighbor) continue
      if (neighbor.sides[neighborDef.oppositeSide] !== TileSideType.City)
        continue
      const city = cityIndex.get(
        `${coords.rowIndex}:${coords.tileIndex}:${neighborDef.oppositeSide}`
      )
      if (city) cityIds.add(city.id)
    }
  }

  return cityIds
}

/**
 * Финальный подсчёт полей: по каждому полю со крестьянами собираются уникальные
 * соприкасающиеся завершённые города, считаются крестьяне (большой — за двух),
 * определяются все лидеры и каждому начисляются по 3 очка за каждый такой город.
 * Один город учитывается отдельно на каждом поле, но только один раз в пределах
 * одного поля.
 */
export function scoreFields(state: ScoringBoard): void {
  const fieldFollowers = state.fieldFollowers ?? []
  if (!fieldFollowers.length) return

  const components = buildFieldComponents(state.tilePlacesStats)
  const cityIndex = cityPointIndex(state.completedObjects.cities)

  const nodeToComponent = new Map<string, string>()
  for (const component of components) {
    for (const region of component.regions) {
      nodeToComponent.set(
        `${region.rowIndex},${region.tileIndex},${region.regionIndex}`,
        component.id
      )
    }
  }

  const followersByComponent = new Map<string, FieldFollower[]>()
  for (const follower of fieldFollowers) {
    const p = follower.point
    const componentId = nodeToComponent.get(
      `${p.rowIndex ?? p.y},${p.tileIndex ?? p.x},${p.regionIndex ?? 0}`
    )
    if (!componentId) continue
    const list = followersByComponent.get(componentId) ?? []
    list.push(follower)
    followersByComponent.set(componentId, list)
  }

  const pointsPerCity = 3
  for (const [componentId, followers] of followersByComponent) {
    const component = components.find((c) => c.id === componentId)
    if (!component) continue

    const cityIds = collectAdjacentCityIds(
      state.tilePlacesStats,
      cityIndex,
      component
    )
    if (!cityIds.size) continue

    const weightByPlayer = new Map<string, number>()
    for (const follower of followers) {
      const weight = follower.isBigFollower ? 2 : 1
      const key = String(follower.playerId)
      weightByPlayer.set(key, (weightByPlayer.get(key) ?? 0) + weight)
    }

    const maxWeight = Math.max(...weightByPlayer.values())
    const pointsPerLeader = pointsPerCity * cityIds.size
    const players: Partial<Record<PlayerId, number>> = {}
    let total = 0

    for (const [playerId, weight] of weightByPlayer) {
      if (weight === maxWeight) {
        players[playerId] = pointsPerLeader
        total += pointsPerLeader
        state.scores[playerId] = (state.scores[playerId] ?? 0) + pointsPerLeader
      }
    }

    state.recordAction({
      actionType: ActionTypes.ADDING_SCORES,
      actionData: {
        objectType: ObjectTypes.FIELD,
        objectData: { id: componentId, points: [], followers: [] },
        score: { total, players, objectId: componentId },
        details: [
          {
            label: 'Завершённые города у поля',
            count: cityIds.size,
            pointsPerUnit: pointsPerCity,
            total: pointsPerLeader,
          },
        ],
        modifiers: [],
        isFinalScoring: true,
      },
    })
  }
}
