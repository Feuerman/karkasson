import { plural, t } from './i18n'

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
 * заброшена. Склонения и порядок слов подстраиваются под текущий язык.
 */
export const formatRelativeTime = (
  timestamp: number,
  now: number = Date.now()
): string => {
  if (!timestamp) return ''

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return t('ui_just_now')

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const unit = plural(minutes, {
      one: t('time_minute_one'),
      two: t('time_minute_two'),
      five: t('time_minute_five'),
      other: t('time_minute_other'),
    })
    return `${minutes} ${unit} ${t('ui_ago')}`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const unit = plural(hours, {
      one: t('time_hour_one'),
      two: t('time_hour_two'),
      five: t('time_hour_five'),
      other: t('time_hour_other'),
    })
    return `${hours} ${unit} ${t('ui_ago')}`
  }

  const days = Math.floor(hours / 24)
  if (days === 1) {
    return t('ui_yesterday')
  }

  const unit = plural(days, {
    one: t('time_day_one'),
    two: t('time_day_two'),
    five: t('time_day_five'),
    other: t('time_day_other'),
  })
  return `${days} ${unit} ${t('ui_ago')}`
}
