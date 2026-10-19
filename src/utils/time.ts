import { pluralForm } from './common'

/**
 * Длительность в формате «мм:сс».
 *
 * Формат короткий: таймер хода показывается в узкой панели партии, и длинная
 * запись «1 час 5 минут» там не поместилась бы.
 */
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60

  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * Давность события: «только что», «5 минут назад», «вчера».
 *
 * Нужна в списке партий: по ней видно, какая комната живая, а какая
 * заброшена.
 */
export const formatRelativeTime = (
  timestamp: number,
  now: number = Date.now()
): string => {
  if (!timestamp) return ''

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'только что'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} ${pluralForm(minutes, 'минуту', 'минуты', 'минут')} назад`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} ${pluralForm(hours, 'час', 'часа', 'часов')} назад`
  }

  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'

  return `${days} ${pluralForm(days, 'день', 'дня', 'дней')} назад`
}
