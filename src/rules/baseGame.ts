import type { RulesDocument } from './types'
import {
  baseRulesSection,
  innsAndCathedralsRulesSection,
  princessAndDragonRulesSection,
  riverRulesSection,
} from './baseGame/index'
import { getLocale } from '@/utils/i18n'
import { localizeRulesDocument } from './localize'

export const baseGameRules: RulesDocument = {
  id: 'base-game',
  title: 'Правила игры',
  subtitle:
    'Базовая игра и дополнения «Таверны и соборы», «Река» и «Принцесса и дракон»',
  sections: [
    baseRulesSection,
    innsAndCathedralsRulesSection,
    princessAndDragonRulesSection,
    riverRulesSection,
  ],
}

/** Правила на языке интерфейса: английский текст подставляется при выборе en. */
export const getBaseGameRules = (): RulesDocument =>
  getLocale() === 'en' ? localizeRulesDocument(baseGameRules) : baseGameRules
