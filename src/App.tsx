import { useEffect, useMemo, useState } from 'react'
import { AppProvider, useApp } from './store'
import { AuthProvider } from './auth'
import { ScreenProvider, useScreen } from './screens'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { NotesPanel } from './components/NotesPanel'
import { TimeGrid } from './components/TimeGrid'
import { MonthView } from './components/MonthView'
import { EventModal } from './components/EventModal'
import { AuthPage } from './components/AuthPage'
import { AccountSettings } from './components/AccountSettings'
import { Drawer } from './components/ui'
import { dateKey, isWeekend, weekDays } from './lib/date'

function MainArea() {
  const { view, selectedDate, settings, focusDay } = useApp()

  const days = useMemo(() => {
    const week = weekDays(selectedDate, settings.weekStartsOn)
    return settings.showWeekends ? week : week.filter((d) => !isWeekend(d))
  }, [selectedDate, settings.weekStartsOn, settings.showWeekends])

  if (view === 'month') return <MonthView />
  if (view === 'day') return <TimeGrid key="day" days={[selectedDate]} />
  // Full Week narrowed to the chosen day: one full-width column, still the
  // Full Week view, until the Full Week button is pressed again.
  if (focusDay) return <TimeGrid key={`focus-${dateKey(selectedDate)}`} days={[selectedDate]} />
  return <TimeGrid key={`week-${days.length}`} days={days} />
}

function Shell() {
  const { screen } = useScreen()
  const { goToToday, setView, navigate } = useApp()
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  useEffect(() => {
    if (screen !== 'app') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowLeft':
          navigate(-1)
          break
        case 'ArrowRight':
          navigate(1)
          break
        case 't':
        case 'T':
          goToToday()
          break
        case 'd':
        case 'D':
          setView('day')
          break
        case 'w':
        case 'W':
          setView('week')
          break
        case 'm':
        case 'M':
          setView('month')
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, goToToday, setView, screen])

  if (screen === 'signin' || screen === 'signup') return <AuthPage />
  if (screen === 'account') return <AccountSettings />

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <TopBar
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => setRightOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:flex">
          <Sidebar />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MainArea />
        </main>
        <div className="hidden xl:flex">
          <NotesPanel />
        </div>
      </div>

      <EventModal />

      {leftOpen && (
        <Drawer side="left" onClose={() => setLeftOpen(false)}>
          <Sidebar />
        </Drawer>
      )}
      {rightOpen && (
        <Drawer side="right" hideFrom="xl" onClose={() => setRightOpen(false)}>
          <NotesPanel />
        </Drawer>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ScreenProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </ScreenProvider>
    </AuthProvider>
  )
}
