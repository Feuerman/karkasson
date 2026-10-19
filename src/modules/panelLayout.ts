import { ref } from 'vue'
import {
  clearPanelLayout,
  readPanelLayout,
  writePanelCollapsed,
  writePanelPosition,
  type PanelLayoutState,
  type PanelPosition,
} from '@/utils/panelLayout'

/**
 * Общее состояние раскладки окон.
 *
 * Версия растёт при сбросе раскладки: окна и панели следят за ней и
 * возвращаются к исходному виду — и места, и развёрнутому состоянию.
 */
export const panelLayoutVersion = ref(0)

/** Сохранённая раскладка: позиции окон и признаки свёрнутости. */
export const readSavedPanelLayout = (): PanelLayoutState => readPanelLayout()

/** Сохраняет место окна, чтобы вернуть его после перезагрузки. */
export const savePanelPosition = (
  id: string,
  position: PanelPosition
): void => {
  writePanelPosition(id, position)
}

/** Сохраняет признак свёрнутости окна. */
export const savePanelCollapsed = (id: string, collapsed: boolean): void => {
  writePanelCollapsed(id, collapsed)
}

/**
 * Сбрасывает раскладку: сохранённые места и свёрнутые окна удаляются, а
 * окна возвращаются к исходным местам и разворачиваются.
 */
export const resetPanelLayout = (): void => {
  clearPanelLayout()
  panelLayoutVersion.value += 1
}
