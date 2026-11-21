/**
 * Раскладка окон партии.
 *
 * Позиции панелей и состояние «свёрнуто» хранятся в браузере: игрок
 * расставляет окна под себя и после перезагрузки получает ту же картину.
 * Хранилище может быть недоступно (приватный режим, отключённое хранилище),
 * поэтому все операции безопасны: при ошибке раскладка просто не сохраняется.
 */

import { isRecord } from './common'
import {
  getStorage,
  readStorageItem,
  removeStorageItem,
  writeStorageItem,
} from './storage'

export interface PanelPosition {
  x: number
  y: number
}

export interface PanelLayoutState {
  /** Позиции панелей: идентификатор окна → координаты. */
  positions: Record<string, PanelPosition>
  /** Свернутые окна: идентификатор окна → признак свёрнутости. */
  collapsed: Record<string, boolean>
}

export const PANEL_LAYOUT_STORAGE_KEY = 'panelLayout'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isPanelPosition = (value: unknown): value is PanelPosition => {
  if (!isRecord(value)) return false
  const position = value as Partial<PanelPosition>
  return isFiniteNumber(position.x) && isFiniteNumber(position.y)
}

/**
 * Читает сохранённую раскладку.
 *
 * Повреждённые и неизвестные данные игнорируются: интерфейс не должен падать
 * из-за старой или подправленной записи в хранилище.
 */
export const readPanelLayout = (
  storage: Storage | null = getStorage()
): PanelLayoutState => {
  const raw = readStorageItem(PANEL_LAYOUT_STORAGE_KEY)
  if (!storage || !raw) {
    return { positions: {}, collapsed: {} }
  }
  let source: unknown
  try {
    source = JSON.parse(raw)
  } catch {
    return { positions: {}, collapsed: {} }
  }
  if (!isRecord(source)) {
    return { positions: {}, collapsed: {} }
  }

  const positions: Record<string, PanelPosition> = {}
  const collapsed: Record<string, boolean> = {}

  for (const [id, value] of Object.entries(source.positions ?? {})) {
    if (isPanelPosition(value)) positions[id] = { x: value.x, y: value.y }
  }

  for (const [id, value] of Object.entries(source.collapsed ?? {})) {
    if (typeof value === 'boolean') collapsed[id] = value
  }

  return { positions, collapsed }
}

/** Сохраняет позицию окна, не затирая остальную раскладку. */
export const writePanelPosition = (
  id: string,
  position: PanelPosition,
  storage: Storage | null = getStorage()
): void => {
  const state = readPanelLayout(storage)
  state.positions[id] = { x: position.x, y: position.y }
  writeStorageItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(state))
}

/** Сохраняет признак свёрнутости окна. */
export const writePanelCollapsed = (
  id: string,
  collapsed: boolean,
  storage: Storage | null = getStorage()
): void => {
  const state = readPanelLayout(storage)
  state.collapsed[id] = collapsed
  writeStorageItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(state))
}

/** Убирает сохранённую раскладку: окна возвращаются к исходным местам. */
export const clearPanelLayout = (): void => {
  removeStorageItem(PANEL_LAYOUT_STORAGE_KEY)
}
