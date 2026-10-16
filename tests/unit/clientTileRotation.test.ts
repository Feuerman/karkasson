import { describe, expect, it } from 'vitest'
import { normalizeRotation, rotateTile, rotationClass } from '@/utils/tiles'
import { rotateTileSides } from '@server/modules/tileRotation'
import {
  RotationDirection,
  SideName,
  TileSideType,
  TILE_ROTATIONS,
  type Tile,
  type TileSides,
} from '@server/modules/types'

/**
 * Сервер и клиент поворачивают тайл независимо: сервер решает, куда легли
 * стороны, клиент рисует именно так, как повернул. Расхождение не ломает
 * правила, но тихо рисует неверную доску, поэтому поворот сверяется с
 * эталоном сервера для всех направлений и стартовых углов.
 */

const ORIGINAL_SIDES: TileSides = {
  [SideName.North]: TileSideType.City,
  [SideName.East]: TileSideType.Road,
  [SideName.South]: TileSideType.Field,
  [SideName.West]: TileSideType.City,
}

const SERVER_TURN_STEPS: Record<RotationDirection, number> = {
  [RotationDirection.Clockwise]: 1,
  [RotationDirection.Counterclockwise]: -1,
}

const CLIENT_DEGREE_SHIFT: Record<RotationDirection, number> = {
  [RotationDirection.Clockwise]: 90,
  [RotationDirection.Counterclockwise]: -90,
}

function makeTile(rotation: number): Tile {
  return {
    id: 'client-rotation-tile',
    rotation,
    sides: { ...ORIGINAL_SIDES },
  }
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
          rotateTileSides(ORIGINAL_SIDES, SERVER_TURN_STEPS[direction])
        )
        expect(rotated.rotation).toBe(
          normalizeRotation(startRotation + CLIENT_DEGREE_SHIFT[direction])
        )
      }
    )

    it('не мутирует исходный тайл', () => {
      const original = makeTile(0)
      const originalSnapshot = structuredClone(original)

      rotateTile(original, direction)

      expect(original).toEqual(originalSnapshot)
    })

    it('четыре последовательных поворота возвращают тайл в исходное состояние', () => {
      const original = makeTile(0)
      let rotated = original
      for (let turn = 0; turn < 4; turn += 1) {
        rotated = rotateTile(rotated, direction)
      }

      expect(rotated).toEqual(original)
    })
  }
)
