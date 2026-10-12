import { describe, expect, it } from 'vitest'
import { normalizeRotation, rotateTile, rotationClass } from '@/utils/tiles'
import type { ITile } from '@/types/game'
import { rotateTileSides } from '@server/modules/tileRotation'
import {
  RotationDirection,
  SideName,
  TileSideType,
  TILE_ROTATIONS,
  type TileSides,
} from '@server/modules/types'

/**
 * Сервер и клиент поворачивают тайл независимо: сервер решает, куда легли
 * стороны, клиент рисует именно так, как повернул. Расхождение не ломает
 * правила, но тихо рисует неверную доску, поэтому поворот сверяется с
 * эталоном сервера для всех направлений и стартовых углов.
 */

const sides: TileSides = {
  [SideName.North]: TileSideType.City,
  [SideName.East]: TileSideType.Road,
  [SideName.South]: TileSideType.Field,
  [SideName.West]: TileSideType.City,
}

const QUARTER_TURNS: Record<RotationDirection, number> = {
  [RotationDirection.Clockwise]: 1,
  [RotationDirection.Counterclockwise]: -1,
}

const DEGREE_SHIFT: Record<RotationDirection, number> = {
  [RotationDirection.Clockwise]: 90,
  [RotationDirection.Counterclockwise]: -90,
}

function makeTile(rotation: number): ITile {
  return { id: 'client-rotation-tile', rotation, sides: { ...sides } }
}

describe('Нормализация угла поворота на клиенте', () => {
  it.each([
    [0, 0],
    [90, 90],
    [180, 180],
    [270, 270],
    [360, 0],
    [450, 90],
    [-90, 270],
    [-450, 270],
  ])('превращает %i° в %i°', (rotation, expected) => {
    expect(normalizeRotation(rotation)).toBe(expected)
  })
})

describe('CSS-класс поворота на клиенте', () => {
  it.each(TILE_ROTATIONS)('для угла %i° берёт класс rotate-%i', (rotation) => {
    expect(rotationClass(rotation)).toBe(`rotate-${rotation}`)
  })

  it('переводит полные и отрицательные обороты в тот же класс', () => {
    expect(rotationClass(360)).toBe('rotate-0')
    expect(rotationClass(-90)).toBe('rotate-270')
    expect(rotationClass(720)).toBe('rotate-0')
  })

  it('для угла вне кратных 90° оставляет тайл без поворота', () => {
    expect(rotationClass(45)).toBe('rotate-0')
  })
})

describe.each(Object.values(RotationDirection))(
  'Согласование поворота с сервером (%s)',
  (direction) => {
    it.each(TILE_ROTATIONS)(
      'стартовый угол %i° даёт серверные стороны и угол',
      (startRotation) => {
        const rotated = rotateTile(makeTile(startRotation), direction)

        expect(rotated.sides).toEqual(
          rotateTileSides(sides, QUARTER_TURNS[direction])
        )
        expect(rotated.rotation).toBe(
          normalizeRotation(startRotation + DEGREE_SHIFT[direction])
        )
      }
    )

    it('не мутирует исходный тайл', () => {
      const original = makeTile(0)
      const originalSides = { ...original.sides }

      rotateTile(original, direction)

      expect(original.sides).toEqual(originalSides)
      expect(original.rotation).toBe(0)
    })

    it('четыре последовательных поворота возвращают тайл в исходное состояние', () => {
      let rotated = makeTile(0)
      for (let turn = 0; turn < 4; turn += 1) {
        rotated = rotateTile(rotated, direction)
      }

      expect(rotated.sides).toEqual(sides)
      expect(rotated.rotation).toBe(0)
    })
  }
)
