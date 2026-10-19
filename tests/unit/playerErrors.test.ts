import { describe, expect, it } from 'vitest'
import { toPlayerErrorMessage } from '@server/socket/handlers/playerErrors'
import {
  describePlacementConflicts,
  PLACEMENT_FAILURE_MESSAGE,
} from '@server/socket/handlers/placementErrors'
import { CommonErrors, GameErrors, LobbyErrors } from '@server/modules/errors'
import { SideName, TileSideType } from '@server/modules/types'

describe('Текст ошибки для игрока', () => {
  it('отдаёт сообщение каталога без изменений', () => {
    expect(toPlayerErrorMessage(new Error(GameErrors.NotPlayersTurn))).toBe(
      GameErrors.NotPlayersTurn
    )
    expect(toPlayerErrorMessage(new Error(LobbyErrors.AllSlotsTaken))).toBe(
      LobbyErrors.AllSlotsTaken
    )
    expect(toPlayerErrorMessage(CommonErrors.GameNotFound)).toBe(
      CommonErrors.GameNotFound
    )
  })

  it('подробное описание конфликта размещения доходит до игрока', () => {
    const message = describePlacementConflicts([
      {
        side: SideName.North,
        rowIndex: 15,
        tileIndex: 15,
        own: TileSideType.Field,
        adjacent: TileSideType.City,
      },
    ])

    expect(toPlayerErrorMessage(new Error(message))).toBe(message)
  })

  it('подробный конфликт признаётся по общему началу сообщения', () => {
    expect(
      toPlayerErrorMessage(
        new Error(`${PLACEMENT_FAILURE_MESSAGE}: река — русло не туда.`)
      )
    ).toBe(`${PLACEMENT_FAILURE_MESSAGE}: река — русло не туда.`)
  })

  it('внутренний текст заменяется общим отказом', () => {
    expect(
      toPlayerErrorMessage(new Error('Game save has no players array'))
    ).toBe(CommonErrors.InternalFailure)
  })

  it('неизвестный отказ без сообщения тоже заменяется общим отказом', () => {
    expect(toPlayerErrorMessage(new Error())).toBe(CommonErrors.InternalFailure)
    expect(toPlayerErrorMessage({ code: 500 })).toBe(
      CommonErrors.InternalFailure
    )
  })
})
