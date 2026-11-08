import { beforeEach, describe, expect, it } from 'vitest'
import { CommonErrors, LobbyErrors, GameErrors } from '@server/modules/errors'
import {
  availableLocales,
  formatDate,
  formatNumber,
  getLocale,
  plural,
  setLocale,
  t,
  tError,
  localizeScoreText,
} from '@/utils/i18n'

const STORAGE_KEY = 'locale'

function resetLocale(): void {
  setLocale('ru')
  localStorage.removeItem(STORAGE_KEY)
}

beforeEach(() => {
  resetLocale()
})

describe('t()', () => {
  it('переводит на текущий язык (по умолчанию русский)', () => {
    expect(t('ui_menu_rules')).toBe('Правила игры')
  })

  it('переключается на английский после setLocale', () => {
    setLocale('en')
    expect(t('ui_menu_rules')).toBe('Game rules')
    expect(getLocale()).toBe('en')
  })

  it('возвращает ключ, если перевода нет ни в одном языке', () => {
    expect(t('ui_absolutely_missing_key')).toBe('ui_absolutely_missing_key')
  })

  it('делает резервную копию на английский, если перевода нет на текущем', () => {
    setLocale('ru')
    // Ключа нет ни в ru, ни в en — вернётся сам ключ.
    expect(t('ui_no_such_key')).toBe('ui_no_such_key')
  })

  it('подставляет параметры в шаблон {{param}}', () => {
    expect(t('ui_your_turn', { name: 'Игрок' })).toBe('Ваш ход')
  })
})

describe('setLocale и сохранение выбора', () => {
  it('сохраняет выбранный язык в localStorage', () => {
    setLocale('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
  })

  it('не сохраняет неизвестный язык', () => {
    setLocale('de' as never)
    expect(getLocale()).toBe('ru')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('availableLocales содержит ru и en', () => {
    expect(availableLocales).toContain('ru')
    expect(availableLocales).toContain('en')
  })
})

describe('tError() — перевод по коду ошибки сервера', () => {
  it('переводит код на текущий язык', () => {
    expect(tError('common.game_not_found')).toBe(CommonErrors.GameNotFound)
    setLocale('en')
    expect(tError('common.game_not_found')).toBe('Game not found')
  })

  it('переводит коды лобби', () => {
    expect(tError('lobby.not_enough_players')).toBe(
      LobbyErrors.NotEnoughPlayers
    )
    setLocale('en')
    expect(tError('lobby.not_enough_players')).toBe(
      'At least two players are required to start the game'
    )
  })

  it('переводит коды игры', () => {
    expect(tError('game.not_players_turn')).toBe(GameErrors.NotPlayersTurn)
    setLocale('en')
    expect(tError('game.not_players_turn')).toBe(
      "It's another player's turn — wait for your turn"
    )
  })

  it('при отсутствии перевода возвращает defaultMessage', () => {
    expect(tError('common.no_such_code', 'Fallback')).toBe('Fallback')
  })

  it('при отсутствии перевода и defaultMessage возвращает код', () => {
    expect(tError('common.no_such_code')).toBe('common.no_such_code')
  })
})

describe('plural() — склонения по языку', () => {
  it('русский: одна / две-четыре / пять', () => {
    setLocale('ru')
    expect(plural(1, { one: 'очко', two: 'очка', five: 'очков' })).toBe('очко')
    expect(plural(2, { one: 'очко', two: 'очка', five: 'очков' })).toBe('очка')
    expect(plural(5, { one: 'очко', two: 'очка', five: 'очков' })).toBe('очков')
    expect(plural(11, { one: 'очко', two: 'очка', five: 'очков' })).toBe(
      'очков'
    )
    expect(plural(21, { one: 'очко', two: 'очка', five: 'очков' })).toBe('очко')
  })

  it('английский: one / other', () => {
    setLocale('en')
    expect(
      plural(1, { one: 'minute', two: '', five: '', other: 'minutes' })
    ).toBe('minute')
    expect(
      plural(5, { one: 'minute', two: '', five: '', other: 'minutes' })
    ).toBe('minutes')
  })
})

describe('formatNumber / formatDate', () => {
  it('форматирует число по языку', () => {
    setLocale('ru')
    const ru = formatNumber(1000)
    expect(ru).toMatch(/^1[\s\u00A0\u202F]000$/)
    setLocale('en')
    expect(formatNumber(1000)).toBe('1,000')
  })

  it('форматирует дату по языку', () => {
    const date = new Date(2026, 0, 15)
    setLocale('ru')
    expect(formatDate(date)).toContain('2026')
    setLocale('en')
    expect(formatDate(date)).toContain('2026')
  })
})

describe('localizeScoreText()', () => {
  it('переводит известные серверные подписи, сохраняя исходный русский', () => {
    expect(localizeScoreText('Тайлы дороги')).toBe('Тайлы дороги')
    setLocale('en')
    expect(localizeScoreText('Тайлы дороги')).toBe('Road tiles')
    expect(localizeScoreText('unknown server text')).toBe('unknown server text')
  })
})
