export const COLORS = {
  orange: {
    name: 'Orange',
    bg: '#ffe6cc',
    border: '#f6c48c',
    text: '#8a4b12',
    dot: '#f59e0b',
  },
  lime: {
    name: 'Lime',
    bg: '#e8f7b5',
    border: '#c3e56a',
    text: '#4b6410',
    dot: '#a3e635',
  },
  pink: {
    name: 'Pink',
    bg: '#ffdce9',
    border: '#f5aec9',
    text: '#8c2f55',
    dot: '#f472b6',
  },
  purple: {
    name: 'Purple',
    bg: '#e6ddff',
    border: '#bcaaf0',
    text: '#4b2e8a',
    dot: '#a78bfa',
  },
  yellow: {
    name: 'Yellow',
    bg: '#fdf3ad',
    border: '#eeda5c',
    text: '#7a6410',
    dot: '#eab308',
  },
  blue: {
    name: 'Blue',
    bg: '#d8ebff',
    border: '#9cc7f5',
    text: '#1e4e8c',
    dot: '#60a5fa',
  },
} as const

export type EventColorId = keyof typeof COLORS

export const COLOR_IDS = Object.keys(COLORS) as EventColorId[]

export function colorOf(id: string | undefined) {
  return COLORS[(id as EventColorId) ?? 'lime'] ?? COLORS.lime
}

/** Stable set of colours used when auto-creating calendars. */
export const AUTO_COLORS: EventColorId[] = [
  'lime',
  'orange',
  'pink',
  'purple',
  'yellow',
  'blue',
]
