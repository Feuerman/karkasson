import { ActionTypes, ObjectTypes } from '@server/modules/types'
import type { GameAction } from '@server/modules/gameActions'
import type { PlayerView, PlayerId, Scores } from '@server/modules/types'

/** Очки игрока, разложенные по источникам. */
export interface ScoreBreakdown {
  cities: number
  roads: number
  monasteries: number
  gardens: number
  fields: number
  /** Очки, которые не удалось разложить по объектам. */
  other: number
}

/** Итог партии по одному игроку. */
export interface PlayerResult {
  playerId: PlayerId
  name: string
  color: string | null
  total: number
  /** Место в итоговой таблице: при равенстве очков места совпадают. */
  place: number
  isWinner: boolean
  breakdown: ScoreBreakdown
}

const EMPTY_BREAKDOWN: ScoreBreakdown = {
  cities: 0,
  roads: 0,
  monasteries: 0,
  gardens: 0,
  fields: 0,
  other: 0,
}

/** Какому виду объекта соответствует столбец разбивки. */
const OBJECT_BUCKETS: Record<ObjectTypes, keyof ScoreBreakdown> = {
  [ObjectTypes.CITY]: 'cities',
  [ObjectTypes.ROAD]: 'roads',
  [ObjectTypes.MONASTERY]: 'monasteries',
  [ObjectTypes.GARDEN]: 'gardens',
  [ObjectTypes.FIELD]: 'fields',
}

/**
 * Разбивка очков игрока по видам объектов.
 *
 * Источник — записи истории о начислении очков: там сервер пишет, сколько
 * очков и за какой объект получил каждый игрок.
 */
export const buildScoreBreakdown = (
  actionsHistory: GameAction[] | undefined,
  playerId: PlayerId
): ScoreBreakdown => {
  const breakdown: ScoreBreakdown = { ...EMPTY_BREAKDOWN }

  for (const action of actionsHistory ?? []) {
    if (action.actionType !== ActionTypes.ADDING_SCORES) continue

    const bucket = OBJECT_BUCKETS[action.actionData.objectType]
    if (!bucket) continue

    breakdown[bucket] +=
      action.actionData.score.players?.[String(playerId)] ?? 0
  }

  return breakdown
}

/**
 * Приводит разбивку очков к итоговому счёту сервера.
 *
 * Очки по объектам берутся из истории начислений, а итог — от сервера
 * (авторитетный). Сумма разбивки должна совпадать с итогом. Если история
 * начисляет по объектам больше, чем итог сервера (расхождение исходных
 * данных), значения по объектам сжимаются пропорционально до итога, а
 * «прочие начисления» обнуляются — иначе детализация покажет сумму больше
 * итогового счёта.
 */
const reconcileBreakdownToTotal = (
  breakdown: ScoreBreakdown,
  total: number
): ScoreBreakdown => {
  const objectKeys: (keyof ScoreBreakdown)[] = [
    'cities',
    'roads',
    'monasteries',
    'gardens',
    'fields',
  ]
  const fromObjects = objectKeys.reduce((sum, key) => sum + breakdown[key], 0)

  if (fromObjects <= total) {
    return { ...breakdown, other: Math.max(0, total - fromObjects) }
  }

  const ratio = total / fromObjects
  const scaled: ScoreBreakdown = { ...EMPTY_BREAKDOWN }
  let sum = 0
  for (const key of objectKeys) {
    const value = Math.floor(breakdown[key] * ratio)
    scaled[key] = value
    sum += value
  }

  // Остаток от округления распределяем по крупнейшим вкладам, чтобы сумма
  // сошлась с итоговым счётом ровно.
  const ordered = objectKeys.slice().sort((a, b) => scaled[b] - scaled[a])
  let index = 0
  while (sum < total) {
    scaled[ordered[index % ordered.length]] += 1
    sum += 1
    index += 1
  }

  return scaled
}

/**
 * Итоговая таблица партии.
 *
 * Порядок и места считаются по очкам сервера: при равном счёте игроки делят
 * место, а следующее место пропускается.
 */
export const buildGameResults = (
  players: PlayerView[],
  scores: Scores | undefined,
  actionsHistory?: GameAction[],
  winnerPlayerIds: PlayerId[] = []
): PlayerResult[] => {
  const results: PlayerResult[] = players.map((player) => {
    const total = scores?.[player.id] ?? 0
    const breakdown = buildScoreBreakdown(actionsHistory, player.id)

    return {
      playerId: player.id,
      name: player.name ?? '',
      color: player.color ?? null,
      total,
      place: 0,
      isWinner: winnerPlayerIds.some(
        (winnerId) => String(winnerId) === String(player.id)
      ),
      breakdown: reconcileBreakdownToTotal(breakdown, total),
    }
  })

  results.sort((a, b) => b.total - a.total)

  let place = 0
  let previousTotal: number | null = null
  results.forEach((result, index) => {
    if (previousTotal === null || result.total !== previousTotal) {
      place = index + 1
      previousTotal = result.total
    }
    result.place = place
  })

  return results
}
