import { ref } from 'vue'

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
    message:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error),
    code,
  }
}

export function clearCriticalError(): void {
  criticalError.value = null
}
