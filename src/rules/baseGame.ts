import type { RulesDocument } from './types'
import {
  baseRulesSection,
  innsAndCathedralsRulesSection,
  princessAndDragonRulesSection,
  riverRulesSection,
} from './baseGame/index'

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
