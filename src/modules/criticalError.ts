import { ref } from 'vue'
import { errorToString } from '../utils/common'

/**
 * Необработанная ошибка приложения: показывается экран «что-то пошло не так»
 * с кнопкой перезагрузки. Ошибка компонента и необработанное отклонение
 * промиса попадают сюда через глобальный обработчик Vue.
 */
export interface CriticalError {
  message: string
  code?: string
}

export const criticalError = ref<CriticalError | null>(null)

export function setCriticalError(error: unknown, code?: string): void {
  criticalError.value = {
    message: errorToString(error),
    code,
  }
}

export function clearCriticalError(): void {
  criticalError.value = null
}
