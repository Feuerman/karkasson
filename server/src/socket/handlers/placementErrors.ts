/**
 * Тексты ошибок размещения тайла.
 *
 * Тексты живут в транспортном слое, а не в домене: домен возвращает
 * структурированные конфликты, а транспорт превращает их в сообщения для
 * игрока. Так домен не знает о языке интерфейса.
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

export const PLACEMENT_FAILURE_MESSAGE =
  'Невозможно разместить тайл на этой позиции'

const SIDE_LOCATIVE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'северной стороне',
  [SideName.East]: 'восточной стороне',
  [SideName.South]: 'южной стороне',
  [SideName.West]: 'западной стороне',
}

const SIDE_ON_LABELS: Record<SideName, string> = {
  [SideName.North]: 'севере',
  [SideName.East]: 'востоке',
  [SideName.South]: 'юге',
  [SideName.West]: 'западе',
}

const SIDE_TYPE_LABELS: Record<TileSideType, string> = {
  [TileSideType.Field]: 'поле',
  [TileSideType.Road]: 'дорога',
  [TileSideType.City]: 'город',
}

/** Подробное сообщение об отказе разместить тайл. */
export function describePlacementConflicts(
  conflicts: TileSideConflict[]
): string {
  if (!conflicts.length) return PLACEMENT_FAILURE_MESSAGE

  const details = conflicts
    .map(
      ({ side, own, adjacent }) =>
        `на ${SIDE_LOCATIVE_LABELS[side]} у вас — ${SIDE_TYPE_LABELS[own]}, ` +
        `а у соседнего тайла на ` +
        `${SIDE_ON_LABELS[OPPOSITE_SIDE[side]]} — ` +
        `${SIDE_TYPE_LABELS[adjacent]}`
    )
    .join('; ')

  return `${PLACEMENT_FAILURE_MESSAGE}: ${details}.`
}

/** Подробное сообщение об отказе по правилам реки. */
export function describeRiverConflict(
  conflict: RiverPlacementConflict
): string {
  const detail =
    conflict.reason === 'openEnd'
      ? 'у соседнего тайла остался незакрытый конец русла'
      : 'русло этого тайла выходит не в ту сторону'

  return `${PLACEMENT_FAILURE_MESSAGE}: река — ${detail}.`
}

/** Сообщение о причине неудачного размещения по конфликтам диагностики. */
export function describePlacementFailure(
  conflicts: PlacementConflict[]
): string {
  const sideConflicts: TileSideConflict[] = []
  for (const conflict of conflicts) {
    if (isRiverPlacementConflict(conflict)) {
      return describeRiverConflict(conflict)
    }
    sideConflicts.push(conflict)
  }

  return describePlacementConflicts(sideConflicts)
}
