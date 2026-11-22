import { ref } from 'vue'
import { AccountTab } from '@/types/socket'

/**
 * Управляет активной вкладкой: текущее значение и переключение.
 * Вынесено в общую функциональность, чтобы повторно использовать в разных
 * панелях без дублирования состояния и обработки кликов.
 */
export function useTabs(initialValue: AccountTab = AccountTab.My) {
  const activeTab = ref<AccountTab>(initialValue)

  const switchTab = (value: AccountTab) => {
    activeTab.value = value
  }

  const isActive = (value: AccountTab) => activeTab.value === value

  return { activeTab, switchTab, isActive }
}
