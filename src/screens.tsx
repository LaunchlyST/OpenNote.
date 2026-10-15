import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

/** Top-level views the app can show instead of the calendar. */
export type Screen = 'app' | 'signin' | 'signup' | 'account' | 'forgot' | 'reset'

interface ScreenContextValue {
  screen: Screen
  goTo: (screen: Screen) => void
  close: () => void
}

const ScreenContext = createContext<ScreenContextValue | null>(null)

export function ScreenProvider({
  children,
  initialScreen = 'app',
}: {
  children: ReactNode
  /**
   * Which screen to open on. Only used on mount — afterwards the provider owns
   * the state, so in-app navigation is unaffected.
   */
  initialScreen?: Screen
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen)

  const goTo = useCallback((next: Screen) => setScreen(next), [])
  const close = useCallback(() => setScreen('app'), [])

  const value = useMemo<ScreenContextValue>(
    () => ({ screen, goTo, close }),
    [screen, goTo, close],
  )

  return (
    <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>
  )
}

export function useScreen(): ScreenContextValue {
  const ctx = useContext(ScreenContext)
  if (!ctx) throw new Error('useScreen must be used inside <ScreenProvider>')
  return ctx
}
