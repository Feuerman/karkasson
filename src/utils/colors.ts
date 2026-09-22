const playerColorMap: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  coral: {
    text: 'text-player-coral',
    bg: 'bg-player-coral',
    border: 'border-player-coral',
  },
  skyblue: {
    text: 'text-player-skyblue',
    bg: 'bg-player-skyblue',
    border: 'border-player-skyblue',
  },
  lime: {
    text: 'text-player-lime',
    bg: 'bg-player-lime',
    border: 'border-player-lime',
  },
  gold: {
    text: 'text-player-gold',
    bg: 'bg-player-gold',
    border: 'border-player-gold',
  },
  orchid: {
    text: 'text-player-orchid',
    bg: 'bg-player-orchid',
    border: 'border-player-orchid',
  },
  teal: {
    text: 'text-player-teal',
    bg: 'bg-player-teal',
    border: 'border-player-teal',
  },
  salmon: {
    text: 'text-player-salmon',
    bg: 'bg-player-salmon',
    border: 'border-player-salmon',
  },
  slateblue: {
    text: 'text-player-slateblue',
    bg: 'bg-player-slateblue',
    border: 'border-player-slateblue',
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

export const playerBorderColorClass = (color?: string | null): string =>
  resolvePlayerColor(color).border
