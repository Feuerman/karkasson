import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  panelLayoutVersion,
  readSavedPanelLayout,
  savePanelCollapsed,
} from '@/modules/panelLayout'

/** Уже этой ширины окна панели начинают мешать друг другу. */
export const NARROW_SCREEN_WIDTH = 900

export interface PanelCollapseOptions {
  /**
   * Сворачивать ли окно на узком экране.
   *
   * Постоянные панели (счёт и история) на узком экране мешают доске, поэтому
   * они сворачиваются сами. Окна действий остаются развёрнутыми: игрок не
   * должен искать, куда нажать, чтобы поставить фишку.
   */
  autoCollapseOnNarrow?: boolean
}

/**
 * Сворачивание окна партии.
 *
 * Выбор игрока запоминается: окно, которое он свёрнул, останется свёрнутым и
 * после перезагрузки страницы. Автоматическое сворачивание не запоминается —
 * это следствие размера экрана, а не решение игрока.
 */
export const usePanelCollapse = (
  panelId: string,
  options: PanelCollapseOptions = {}
) => {
  const collapsed = ref(false)
  const isNarrowScreen = ref(false)

  const updateViewport = () => {
    const narrow = window.innerWidth < NARROW_SCREEN_WIDTH
    // Сворачиваем только в момент сужения экрана: иначе окно, которое игрок
    // развернул на телефоне, сложилось бы при любом изменении размера.
    if (narrow && !isNarrowScreen.value && options.autoCollapseOnNarrow) {
      collapsed.value = true
    }
    isNarrowScreen.value = narrow
  }

  onMounted(() => {
    updateViewport()
    window.addEventListener('resize', updateViewport)

    const saved = readSavedPanelLayout().collapsed[panelId]
    if (saved !== undefined) {
      collapsed.value = saved
      return
    }

    if (isNarrowScreen.value && options.autoCollapseOnNarrow) {
      collapsed.value = true
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewport)
  })

  // Сброс раскладки возвращает окна развёрнутыми.
  watch(panelLayoutVersion, () => {
    collapsed.value = false
  })

  const toggle = () => {
    collapsed.value = !collapsed.value
    savePanelCollapsed(panelId, collapsed.value)
  }

  return { collapsed, toggle }
}
