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
  'Невозможно разместить тайл на данной позиции'

const SIDE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'север',
  [SideName.East]: 'восток',
  [SideName.South]: 'юг',
  [SideName.West]: 'запад',
}

const SIDE_GENITIVE_LABELS: Record<SideName, string> = {
  [SideName.North]: 'севера',
  [SideName.East]: 'востока',
  [SideName.South]: 'юга',
  [SideName.West]: 'запада',
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
        `${SIDE_LABELS[side]} — ${SIDE_TYPE_LABELS[own]}, а у соседа с ` +
        `${SIDE_GENITIVE_LABELS[OPPOSITE_SIDE[side]]} — ` +
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
      ? 'река — незакрытый конец русла у соседнего тайла'
      : 'река — русло этого тайла выходит не в ту сторону'

  return `${PLACEMENT_FAILURE_MESSAGE}: ${detail}.`
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
