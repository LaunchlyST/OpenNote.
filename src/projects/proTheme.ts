import { useEffect, useState } from 'react'

/**
 * Pro dashboard background themes. A per-browser choice (localStorage), so it
 * works the same with or without the API; the app's synced preferences are
 * left alone.
 */
export interface ProTheme {
  id: string
  label: string
  /** The page behind everything. */
  canvas: string
  /** The sidebar panel: this is where the theme shows. */
  rail: string
  /** Text and lines on the rail, for dark themes. */
  dark?: boolean
}

export const PRO_THEMES: ProTheme[] = [
  { id: 'paper', label: 'Paper', canvas: '#f4f1ea', rail: '#fffdf8' },
  {
    id: 'mint',
    label: 'Mint',
    canvas: '#f3f8ef',
    rail: 'linear-gradient(180deg, #e6f7d6 0%, #d8f1e6 55%, #f4fbef 100%)',
  },
  {
    id: 'sky',
    label: 'Sky',
    canvas: '#f2f6fc',
    rail: 'linear-gradient(180deg, #dcebff 0%, #e4e0ff 55%, #f5f8ff 100%)',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    canvas: '#f8f5fc',
    rail: 'linear-gradient(180deg, #ece2ff 0%, #fde3f0 55%, #faf6ff 100%)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    canvas: '#fcf7f3',
    rail: 'linear-gradient(180deg, #ffe0c4 0%, #ffd8de 55%, #fff6f1 100%)',
  },
  {
    id: 'gold',
    label: 'Gold',
    canvas: '#fbf6ea',
    rail: 'linear-gradient(180deg, #f8e7b5 0%, #f2d98f 55%, #fcf5e2 100%)',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    canvas: 'radial-gradient(70% 60% at 15% 0%, #12403a 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #1d2f5c 0%, transparent 70%), #0b1416',
    rail: 'linear-gradient(180deg, #123f3a 0%, #1b2d57 60%, #0f1a22 100%)',
    dark: true,
  },
  {
    id: 'legend',
    label: 'Legend',
    canvas: 'radial-gradient(70% 60% at 15% 0%, #3a2a0c 0%, transparent 70%), #110d06',
    rail: 'linear-gradient(180deg, #3d2c0b 0%, #251a07 60%, #140f06 100%)',
    dark: true,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    canvas: 'radial-gradient(70% 60% at 10% 0%, #23314f 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #2b2346 0%, transparent 70%), #0f1320',
    rail: 'linear-gradient(180deg, #1c2742 0%, #231d3c 55%, #141a2b 100%)',
    dark: true,
  },
]

// v2: everyone starts again on Paper, the look the dashboard was designed in
const KEY = 'desknoty.pro.theme.v2'
/** Pro starts on warm Paper; any theme can be picked. */
const DEFAULT = PRO_THEMES[0]
const EVENT = 'desknoty:pro-theme'

function read(): ProTheme {
  try {
    const id = localStorage.getItem(KEY)
    return PRO_THEMES.find((t) => t.id === id) ?? DEFAULT
  } catch {
    return DEFAULT
  }
}

/** The chosen theme, kept in sync across every component that reads it. */
export function useProTheme(): [ProTheme, (id: string) => void] {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const sync = () => setTheme(read())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  const choose = (id: string) => {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* storage blocked: lasts for this visit */
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return [theme, choose]
}
