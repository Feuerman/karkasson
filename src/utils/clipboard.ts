/**
 * Копирование текста в буфер обмена.
 *
 * Основной способ — буфер обмена браузера. Если доступа к нему нет
 * (запрет на API или старый браузер), используется запасной: скрытое поле
 * ввода, из которого команда копирования выбирает текст.
 */

/** Копирует текст. Возвращает false, если скопировать не удалось. */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Буфер обмена недоступен: пробуем запасной способ.
    }
  }

  return copyWithHiddenField(text)
}

/** Запасной способ копирования: скрытое поле ввода. */
const copyWithHiddenField = (text: string): boolean => {
  if (typeof document === 'undefined') return false

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(field)
  }
}
