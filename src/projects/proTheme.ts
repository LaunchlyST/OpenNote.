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
  /** Sidebar surface. */
  rail: string
  /** Text and lines on the rail, for dark themes. */
  dark?: boolean
}

export const PRO_THEMES: ProTheme[] = [
  { id: 'paper', label: 'Paper', canvas: '#fafaf9', rail: 'rgba(255,255,255,0.86)' },
  {
    id: 'mint',
    label: 'Mint',
    canvas: 'radial-gradient(70% 60% at 15% 0%, #dff7c8 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #d4f3ea 0%, transparent 70%), #f6fbf3',
    rail: 'rgba(255,255,255,0.72)',
  },
  {
    id: 'sky',
    label: 'Sky',
    canvas: 'radial-gradient(70% 60% at 10% 0%, #d6e9ff 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #e3ddff 0%, transparent 70%), #f5f8fd',
    rail: 'rgba(255,255,255,0.72)',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    canvas: 'radial-gradient(70% 60% at 20% 0%, #ece3ff 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #ffe3f1 0%, transparent 70%), #faf7fd',
    rail: 'rgba(255,255,255,0.72)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    canvas: 'radial-gradient(70% 60% at 10% 0%, #ffe2c8 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #ffd6dc 0%, transparent 70%), #fdf8f4',
    rail: 'rgba(255,255,255,0.72)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    canvas: 'radial-gradient(70% 60% at 10% 0%, #23314f 0%, transparent 70%), radial-gradient(60% 60% at 100% 100%, #2b2346 0%, transparent 70%), #0f1320',
    rail: 'rgba(22,26,40,0.78)',
    dark: true,
  },
]

const KEY = 'desknoty.pro.theme'
const EVENT = 'desknoty:pro-theme'

function read(): ProTheme {
  try {
    const id = localStorage.getItem(KEY)
    return PRO_THEMES.find((t) => t.id === id) ?? PRO_THEMES[0]
  } catch {
    return PRO_THEMES[0]
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
