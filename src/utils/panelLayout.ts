/**
 * Раскладка окон партии.
 *
 * Позиции панелей и состояние «свёрнуто» хранятся в браузере: игрок
 * расставляет окна под себя и после перезагрузки получает ту же картину.
 * Хранилище может быть недоступно (приватный режим, отключённое хранилище),
 * поэтому все операции безопасны: при ошибке раскладка просто не сохраняется.
 */

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
  if (typeof value !== 'object' || value === null) return false
  const position = value as Partial<PanelPosition>
  return isFiniteNumber(position.x) && isFiniteNumber(position.y)
}

/** Хранилище браузера; в тестах и серверной сборке его может не быть. */
const getStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const readRaw = (storage: Storage | null): unknown => {
  if (!storage) return null
  try {
    const raw = storage.getItem(PANEL_LAYOUT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeRaw = (storage: Storage | null, state: PanelLayoutState): void => {
  if (!storage) return
  try {
    storage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Хранилище переполнено или запрещено: раскладка просто не сохранится.
  }
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
  const raw = readRaw(storage)
  if (typeof raw !== 'object' || raw === null) {
    return { positions: {}, collapsed: {} }
  }

  const source = raw as Partial<PanelLayoutState>
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
  writeRaw(storage, state)
}

/** Сохраняет признак свёрнутости окна. */
export const writePanelCollapsed = (
  id: string,
  collapsed: boolean,
  storage: Storage | null = getStorage()
): void => {
  const state = readPanelLayout(storage)
  state.collapsed[id] = collapsed
  writeRaw(storage, state)
}

/** Убирает сохранённую раскладку: окна возвращаются к исходным местам. */
export const clearPanelLayout = (
  storage: Storage | null = getStorage()
): void => {
  if (!storage) return
  try {
    storage.removeItem(PANEL_LAYOUT_STORAGE_KEY)
  } catch {
    // Хранилище недоступно: сброс просто не сохранится.
  }
}
