import type { PointDirection } from '@server/modules/types'

/** Допустимые повороты тайла (по часовой стрелке). */
export type RulesRotation = 0 | 90 | 180 | 270

/** Цвета подданных на примерах — ключи темы player-*. */
export type RulesMarkerColor = 'coral' | 'skyblue' | 'gold' | 'teal'

/** Цветная точка подданного на грани тайла (или в центре монастыря). */
export interface RulesMarkerFollower {
  kind: 'follower'
  color: RulesMarkerColor
  direction: PointDirection | 'center'
}

/** Красный крестик: действие на этой позиции недопустимо. */
export interface RulesMarkerInvalid {
  kind: 'no'
  direction: PointDirection | 'center'
}

/** Тайл только что выложен (последний ход): синяя пунктирная рамка. */
export interface RulesMarkerNew {
  kind: 'new'
}

/** Тайл относится к завершённому объекту: зелёная рамка. */
export interface RulesMarkerCompleted {
  kind: 'completed'
}

export type RulesMarker =
  | RulesMarkerFollower
  | RulesMarkerInvalid
  | RulesMarkerNew
  | RulesMarkerCompleted

/** Ссылка на тайл в примере. Достаточно id + поворота. */
export interface RulesTileRef {
  id: string
  rotation: RulesRotation
  imgUrl: string
  markers?: RulesMarker[]
}

/** Клетка примера: тайл или пусто. */
export interface RulesGridCell {
  tile?: RulesTileRef
}

/** Наглядный пример: сетка тайлов с подписями. */
export interface RulesExample {
  id: string
  title: string
  description?: string
  grid: RulesGridCell[][]
  caption?: string
  /** Пример намеренно показывает неверную позицию: грани могут не совпадать. */
  intentionalMismatch?: boolean
}

/** Ряд отдельных тайлов (витрина типов тайлов, поворотов и т.п.). */
export interface RulesTilesRow {
  title?: string
  tiles: RulesTileRef[]
  labels?: (string | null)[]
}

export type RulesCalloutTone = 'note' | 'tip' | 'warning'

export type RulesBlock =
  | {
      type: 'paragraph'
      text: string
      /** Необязательный заголовок абзаца. */
      title?: string
    }
  | {
      type: 'list'
      title?: string
      items: string[]
      ordered?: boolean
    }
  | {
      type: 'callout'
      tone: RulesCalloutTone
      title?: string
      text: string
    }
  | {
      type: 'table'
      title?: string
      head: string[]
      rows: string[][]
    }
  | ({ type: 'example' } & RulesExample)
  | ({ type: 'tiles-row' } & RulesTilesRow)

export interface RulesSection {
  id: string
  title: string
  blocks: RulesBlock[]
}

/**
 * Документ с правилами (базовая игра, расширения и т.п.).
 * Каждый документ — набор разделов с типизированными блоками,
 * поэтому содержание легко расширять новыми блоками и разделами.
 */
export interface RulesDocument {
  id: string
  title: string
  subtitle?: string
  sections: RulesSection[]
}
