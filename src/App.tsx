import { useEffect, useMemo, useState } from 'react'
import { AppProvider, useApp } from './store'
import { useAuth } from './auth'
import { ScreenProvider, useScreen } from './screens'
import type { Screen } from './screens'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { NotesPanel } from './components/NotesPanel'
import { TimeGrid } from './components/TimeGrid'
import { MonthView } from './components/MonthView'
import { EventModal } from './components/EventModal'
import { AuthPage } from './components/AuthPage'
import { AccountSettings } from './components/AccountSettings'
import { Drawer } from './components/ui'
import { useMediaQuery } from './hooks'
import { dateKey, isWeekend, weekDays } from './lib/date'

function MainArea() {
  const { view, selectedDate, settings, focusDay } = useApp()

  const days = useMemo(() => {
    const week = weekDays(selectedDate, settings.weekStartsOn)
    return settings.showWeekends ? week : week.filter((d) => !isWeekend(d))
  }, [selectedDate, settings.weekStartsOn, settings.showWeekends])

  if (view === 'month') return <MonthView />
  // Day view and a focused Full Week share one layout: the header keeps all
  // seven day names, the timeline shows only the selected day at full width.
  if (view === 'day')
    return <TimeGrid key="day" days={days} gridDays={[selectedDate]} />
  // Full Week narrowed to the chosen day: one full-width column, still the
  // Full Week view, until the Full Week button is pressed again.
  if (focusDay)
    return (
      <TimeGrid
        key={`focus-${dateKey(selectedDate)}`}
        days={days}
        gridDays={[selectedDate]}
      />
    )
  return <TimeGrid key={`week-${days.length}`} days={days} />
}

function Shell() {
  const { screen } = useScreen()
  const { goToToday, setView, navigate } = useApp()
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)

  // At xl and above Notes is a docked rail; below that it is a drawer, so the
  // same control has to drive whichever one is actually visible.
  const wide = useMediaQuery('(min-width: 1280px)')

  const toggleNotes = () => {
    if (wide) {
      setNotesOpen((o) => {
        if (o) setRightOpen(false)
        return !o
      })
    } else {
      setRightOpen((o) => !o)
    }
  }

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

  if (screen === 'signin' || screen === 'signup' || screen === 'forgot' || screen === 'reset') {
    return <AuthPage />
  }
  if (screen === 'account') return <AccountSettings />

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#f7f7f5]">
      <TopBar
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => setRightOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <div className="hidden lg:flex">
          <div className="overflow-hidden rounded-2xl border border-[#e9e9e7] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
            <Sidebar onToggleNotes={toggleNotes} />
          </div>
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#e9e9e7] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <MainArea />
        </main>
        {notesOpen && (
          <div className="hidden xl:flex">
            <div className="overflow-hidden rounded-2xl border border-[#e9e9e7] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
              <NotesPanel />
            </div>
          </div>
        )}
      </div>

      <EventModal />

      {leftOpen && (
        <Drawer side="left" onClose={() => setLeftOpen(false)}>
          <Sidebar onToggleNotes={toggleNotes} />
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

/** Auth screens are public; the calendar and account settings need a session. */
const PUBLIC_SCREENS: Screen[] = ['signin', 'signup', 'forgot', 'reset']

const SCREEN_PATHS: Partial<Record<Screen, string>> = {
  app: '/app',
  signin: '/app/signin',
  signup: '/app/signup',
  forgot: '/app/forgot-password',
  account: '/app/account',
}

function Gate() {
  const { user, loading } = useAuth()
  const { screen, goTo } = useScreen()
  const needsUser = !PUBLIC_SCREENS.includes(screen)

  // Signed out (or the session expired) while on a private screen: send to sign in.
  // Already signed in on the sign-in / sign-up screen: go straight to the calendar.
  useEffect(() => {
    if (loading) return
    if (!user && needsUser) goTo('signin')
    else if (user && (screen === 'signin' || screen === 'signup')) goTo('app')
  }, [loading, user, needsUser, screen, goTo])

  // Keep the address bar honest, so a reload shows the same screen.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = SCREEN_PATHS[screen]
    if (path && window.location.pathname !== path) {
      window.history.replaceState(null, '', path)
    }
  }, [screen])

  if (needsUser && !user) return <SessionCheck />
  return (
    // Remount per account so one user's workspace never leaks into another's.
    <AppProvider key={user?.id ?? 'guest'} userId={user?.id}>
      <Shell />
    </AppProvider>
  )
}

function SessionCheck() {
  return (
    <div className="grid h-full w-full place-items-center bg-[#f7f7f5]">
      <span className="h-1 w-24 overflow-hidden rounded-full bg-[#e3e3e0]" aria-hidden="true">
        <span className="block h-full w-2/5 animate-pulse rounded-full bg-[#bef264]" />
      </span>
      <span className="sr-only" role="status">
        Checking your session…
      </span>
    </div>
  )
}

export default function App({ screen }: { screen?: Screen } = {}) {
  return (
    <ScreenProvider initialScreen={screen ?? 'app'}>
      <Gate />
    </ScreenProvider>
  )
}
