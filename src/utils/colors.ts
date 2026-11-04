const playerColorMap: Record<
  string,
  { text: string; bg: string; bgText: string; border: string }
> = {
  red: {
    text: 'text-player-red-text',
    bg: 'bg-player-red',
    bgText: 'text-player-red-bg-text',
    border: 'border-player-red',
  },
  yellow: {
    text: 'text-player-yellow-text',
    bg: 'bg-player-yellow',
    bgText: 'text-player-yellow-bg-text',
    border: 'border-player-yellow',
  },
  green: {
    text: 'text-player-green-text',
    bg: 'bg-player-green',
    bgText: 'text-player-green-bg-text',
    border: 'border-player-green',
  },
  blue: {
    text: 'text-player-blue-text',
    bg: 'bg-player-blue',
    bgText: 'text-player-blue-bg-text',
    border: 'border-player-blue',
  },
  black: {
    text: 'text-player-black-text',
    bg: 'bg-player-black',
    bgText: 'text-player-black-bg-text',
    border: 'border-player-black',
  },
  pink: {
    text: 'text-player-pink-text',
    bg: 'bg-player-pink',
    bgText: 'text-player-pink-bg-text',
    border: 'border-player-pink',
  },
}

const neutralColor = {
  text: 'text-border-strong',
  bg: 'bg-surface-muted',
  border: 'border-border-strong',
}

const resolvePlayerColor = (color?: string | null) => {
  return playerColorMap[(color || '').toLowerCase()] ?? neutralColor
}

export const playerTextColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).text

export const playerBackgroundColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).bg

export const playerBackgroundTextColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).bgText

export const playerBorderColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).border

export const playerColorValue = (color?: string | null): string => {
  if (typeof document === 'undefined') return ''

  const normalizedColor = (color || '').toLowerCase()
  const property = playerColorMap[normalizedColor]
    ? `--color-player-${normalizedColor}`
    : '--color-border-strong'

  return getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim()
}
