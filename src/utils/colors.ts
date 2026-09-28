const playerColorMap: Record<
  string,
  { text: string; bg: string; border: string; value: string }
> = {
  coral: {
    text: 'text-player-coral-text',
    bg: 'bg-player-coral',
    border: 'border-player-coral',
    value: '#ff7f50',
  },
  skyblue: {
    text: 'text-player-skyblue-text',
    bg: 'bg-player-skyblue',
    border: 'border-player-skyblue',
    value: '#87ceeb',
  },
  lime: {
    text: 'text-player-lime-text',
    bg: 'bg-player-lime',
    border: 'border-player-lime',
    value: '#00ff00',
  },
  gold: {
    text: 'text-player-gold-text',
    bg: 'bg-player-gold',
    border: 'border-player-gold',
    value: '#ffd700',
  },
  orchid: {
    text: 'text-player-orchid-text',
    bg: 'bg-player-orchid',
    border: 'border-player-orchid',
    value: '#da70d6',
  },
  teal: {
    text: 'text-player-teal-text',
    bg: 'bg-player-teal',
    border: 'border-player-teal',
    value: '#008080',
  },
  salmon: {
    text: 'text-player-salmon-text',
    bg: 'bg-player-salmon',
    border: 'border-player-salmon',
    value: '#fa8072',
  },
  slateblue: {
    text: 'text-player-slateblue-text',
    bg: 'bg-player-slateblue',
    border: 'border-player-slateblue',
    value: '#6a5acd',
  },
}

const neutralColor = {
  text: 'text-border-strong',
  bg: 'bg-surface-muted',
  border: 'border-border-strong',
  value: '#b29b6a',
}

const resolvePlayerColor = (color?: string | null) => {
  return playerColorMap[(color || '').toLowerCase()] ?? neutralColor
}

export const playerTextColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).text

export const playerBackgroundColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).bg

export const playerBorderColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).border

export const playerColorValue = (color?: string | null): string =>
  resolvePlayerColor(color).value
