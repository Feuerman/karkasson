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
