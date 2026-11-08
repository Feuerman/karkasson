/**
 * Тексты ошибок размещения тайла.
 *
 * Тексты живут в транспортном слое, а не в домене: домен возвращает
 * структурированные конфликты, а транспорт превращает их в сообщения для
 * игрока. Так домен не знает о языке интерфейса.
 *
 * Поддерживаются языки клиента ('ru' | 'en'). locale === 'en' включает
 * английский, иначе возвращается русский текст.
 */

import {
  OPPOSITE_SIDE,
  SideName,
  TileSideType,
  isRiverPlacementConflict,
  type PlacementConflict,
  type RiverPlacementConflict,
  type TileSideConflict,
} from '../../modules/types'

/** Отказ разместить тайл: общая часть сообщения на языке игрока. */
export function placementFailureMessage(locale?: string): string {
  return locale === 'en'
    ? 'Unable to place the tile at this position'
    : 'Невозможно разместить тайл на этой позиции'
}

export const PLACEMENT_FAILURE_MESSAGE = placementFailureMessage()

const SIDE_LOCATIVE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'северной стороне',
  [SideName.East]: 'восточной стороне',
  [SideName.South]: 'южной стороне',
  [SideName.West]: 'западной стороне',
}

const SIDE_LOCATIVE_LABELS_EN: Record<SideName, string> = {
  [SideName.North]: 'the north side',
  [SideName.East]: 'the east side',
  [SideName.South]: 'the south side',
  [SideName.West]: 'the west side',
}

const SIDE_ON_LABELS: Record<SideName, string> = {
  [SideName.North]: 'севере',
  [SideName.East]: 'востоке',
  [SideName.South]: 'юге',
  [SideName.West]: 'западе',
}

const SIDE_ON_LABELS_EN: Record<SideName, string> = {
  [SideName.North]: 'the north',
  [SideName.East]: 'the east',
  [SideName.South]: 'the south',
  [SideName.West]: 'the west',
}

const SIDE_TYPE_LABELS: Record<TileSideType, string> = {
  [TileSideType.Field]: 'поле',
  [TileSideType.Road]: 'дорога',
  [TileSideType.City]: 'город',
}

const SIDE_TYPE_LABELS_EN: Record<TileSideType, string> = {
  [TileSideType.Field]: 'field',
  [TileSideType.Road]: 'road',
  [TileSideType.City]: 'city',
}

function sideLabels(locale?: string) {
  return locale === 'en'
    ? {
        locative: SIDE_LOCATIVE_LABELS_EN,
        on: SIDE_ON_LABELS_EN,
        type: SIDE_TYPE_LABELS_EN,
      }
    : {
        locative: SIDE_LOCATIVE_LABELS,
        on: SIDE_ON_LABELS,
        type: SIDE_TYPE_LABELS,
      }
}

/** Подробное сообщение об отказе разместить тайл. */
export function describePlacementConflicts(
  conflicts: TileSideConflict[],
  locale?: string
): string {
  if (!conflicts.length) return placementFailureMessage(locale)

  const { locative, on, type } = sideLabels(locale)
  const en = locale === 'en'

  const details = conflicts
    .map(({ side, own, adjacent }) =>
      en
        ? `on ${locative[side]} you have ${type[own]}, while the neighboring tile on ${on[OPPOSITE_SIDE[side]]} has ${type[adjacent]}`
        : `на ${locative[side]} у вас — ${type[own]}, а у соседнего тайла на ${on[OPPOSITE_SIDE[side]]} — ${type[adjacent]}`
    )
    .join('; ')

  return `${placementFailureMessage(locale)}: ${details}.`
}

/** Подробное сообщение об отказе по правилам реки. */
export function describeRiverConflict(
  conflict: RiverPlacementConflict,
  locale?: string
): string {
  const detail =
    conflict.reason === 'openEnd'
      ? 'у соседнего тайла остался незакрытый конец русла'
      : 'русло этого тайла выходит не в ту сторону'
  const detailEn =
    conflict.reason === 'openEnd'
      ? 'the neighboring tile has an open river end'
      : 'the river of this tile leads in the wrong direction'

  return `${placementFailureMessage(locale)}: ${
    locale === 'en' ? 'river' : 'река'
  } — ${locale === 'en' ? detailEn : detail}.`
}

/** Сообщение о причине неудачного размещения по конфликтам диагностики. */
export function describePlacementFailure(
  conflicts: PlacementConflict[],
  locale?: string
): string {
  const sideConflicts: TileSideConflict[] = []
  for (const conflict of conflicts) {
    if (isRiverPlacementConflict(conflict)) {
      return describeRiverConflict(conflict, locale)
    }
    sideConflicts.push(conflict)
  }

  return describePlacementConflicts(sideConflicts, locale)
}
