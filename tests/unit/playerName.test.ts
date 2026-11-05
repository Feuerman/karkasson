import { describe, expect, it } from 'vitest'
import { normalizePlayerName, playerNameKey } from '@server/modules/playerName'
import { LobbyErrors } from '@server/modules/errors'
import { MAX_PLAYER_NAME_LENGTH } from '@server/modules/types'

describe('Имена игроков', () => {
  it('пустое значение оставляет имя по умолчанию', () => {
    expect(normalizePlayerName(undefined)).toEqual({ name: null })
    expect(normalizePlayerName(null)).toEqual({ name: null })
    expect(normalizePlayerName('   ')).toEqual({ name: null })
  })

  it('нормализует Unicode и лишние пробелы', () => {
    expect(normalizePlayerName('  Ａｌｉｃｅ \n  Иванов  ')).toEqual({
      name: 'Alice Иванов',
    })
  })

  it('отклоняет нестроковое имя и управляющие символы', () => {
    expect(normalizePlayerName(42)).toEqual({
      error: LobbyErrors.PlayerNameInvalid,
    })
    expect(normalizePlayerName('Alice\u0000')).toEqual({
      error: LobbyErrors.PlayerNameInvalid,
    })
    expect(normalizePlayerName('Alice\u202eBob')).toEqual({
      error: LobbyErrors.PlayerNameInvalid,
    })
  })

  it('ограничивает длину по символам Unicode', () => {
    expect(normalizePlayerName('я'.repeat(MAX_PLAYER_NAME_LENGTH))).toEqual({
      name: 'я'.repeat(MAX_PLAYER_NAME_LENGTH),
    })
    expect(normalizePlayerName('я'.repeat(MAX_PLAYER_NAME_LENGTH + 1))).toEqual(
      {
        error: LobbyErrors.PlayerNameTooLong,
      }
    )
    expect(
      normalizePlayerName('😀'.repeat(MAX_PLAYER_NAME_LENGTH + 1))
    ).toEqual({
      error: LobbyErrors.PlayerNameTooLong,
    })
  })

  it('отклоняет нецензурную лексику', () => {
    expect(normalizePlayerName('Ну и хуй')).toEqual({
      error: LobbyErrors.PlayerNameProfanity,
    })
    expect(normalizePlayerName('fuck this')).toEqual({
      error: LobbyErrors.PlayerNameProfanity,
    })
  })

  it('сравнивает имена без регистра, лишних пробелов и разницы ё/е', () => {
    expect(playerNameKey('  Ёлка  ')).toBe(playerNameKey('елка'))
    expect(playerNameKey('Alice')).toBe(playerNameKey(' alice '))
    expect(playerNameKey('Alice')).not.toBe(playerNameKey('Bob'))
  })
})
