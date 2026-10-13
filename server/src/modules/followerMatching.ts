/**
 * Совпадение подданных на доске.
 *
 * Функция общая для всех, кто снимает фишку с поля: она отвечает на вопрос
 * «это та же самая фишка», а не «это тот же объект». Идентификатор объекта
 * намеренно не учитывается — при слиянии дорог и городов объект меняется,
 * а фишка остаётся той же.
 */

import type { ObjectFollower, PlacedFollower } from './types'

/**
 * Совпадение двух подданных одного игрока: игрок, клетка, сторона и тип фишки.
 */
export function isSameFollowerPoint(
  placed: PlacedFollower | ObjectFollower,
  follower: PlacedFollower | ObjectFollower
): boolean {
  return (
    String(placed.playerId) === String(follower.playerId) &&
    placed.point.x === follower.point.x &&
    placed.point.y === follower.point.y &&
    placed.point.direction === follower.point.direction &&
    Boolean(placed.isAbbot) === Boolean(follower.isAbbot) &&
    Boolean(placed.isBigFollower) === Boolean(follower.isBigFollower)
  )
}
