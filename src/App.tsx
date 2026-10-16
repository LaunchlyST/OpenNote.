import { useEffect, useMemo, useState } from 'react'
import { AppProvider, useApp } from './store'
import { ScreenProvider, useScreen } from './screens'
import type { Screen } from './screens'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { NotesPanel } from './components/NotesPanel'
import { SettingsPage } from './components/SettingsPage'
import { TimeGrid } from './components/TimeGrid'
import { MonthView } from './components/MonthView'
import { EventModal } from './components/EventModal'
import { AuthPage } from './components/AuthPage'
import { Drawer } from './components/ui'
import { useEscape, useExitTransition, useMediaQuery, SETTINGS_TRANSITION_MS } from './hooks'
import { dateKey, isWeekend, weekDays } from './lib/date'
import { cn } from './lib/id'

/**
 * The calendar, with the Settings page layered over it.
 *
 * The calendar stays mounted underneath the whole time rather than being
 * swapped for the settings page. That keeps the layout from reflowing, avoids
 * tearing down and rebuilding the grid on every open (and the scroll position
 * with it), and means the exit animation has something to reveal.
 */
function MainArea({
  settingsMounted,
  settingsExiting,
}: {
  settingsMounted: boolean
  settingsExiting: boolean
}) {
  const { view, selectedDate, settings, focusDay } = useApp()

  const days = useMemo(() => {
    const week = weekDays(selectedDate, settings.weekStartsOn)
    return settings.showWeekends ? week : week.filter((d) => !isWeekend(d))
  }, [selectedDate, settings.weekStartsOn, settings.showWeekends])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {view === 'month' ? (
        <MonthView />
      ) : view === 'day' ? (
        <TimeGrid key="day" days={days} gridDays={[selectedDate]} />
      ) : focusDay ? (
        <TimeGrid
          key={`focus-${dateKey(selectedDate)}`}
          days={days}
          gridDays={[selectedDate]}
        />
      ) : (
        <TimeGrid key={`week-${days.length}`} days={days} />
      )}

      {settingsMounted && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col bg-canvas-warm',
            settingsExiting ? 'settings-exit' : 'settings-enter',
          )}
        >
          <SettingsPage />
        </div>
      )}
    </div>
  )
}

function Shell() {
  const { screen } = useScreen()
  const { goToToday, setView, navigate, settingsOpen, openSettings, closeSettings, sidebarCollapsed, setSidebarCollapsed } = useApp()
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)

  const wide = useMediaQuery('(min-width: 1280px)')

  /**
   * The Settings page is layered over the calendar rather than replacing it,
   * so it has to outlive its own exit animation before it unmounts.
   */
  const settingsTransition = useExitTransition(
    settingsOpen,
    SETTINGS_TRANSITION_MS,
  )

  // Escape closes the Settings page, matching the other dismissible surfaces.
  useEscape(settingsOpen, closeSettings)

  const toggleSettings = () => {
    if (settingsOpen) closeSettings()
    else openSettings()
  }

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

  // `/app/account` used to be its own full-screen page. It is now the Settings
  // page opened on Profile, so the sidebar and calendar chrome stay in place.
  useEffect(() => {
    if (screen === 'account') openSettings('profile')
  }, [screen, openSettings])

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface">
      <TopBar
        onToggleLeft={() => setLeftOpen((o) => !o)}
        onToggleRight={() => toggleNotes()}
        onToggleSettings={toggleSettings}
        settingsOpen={settingsOpen}
      />

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 pt-2">
        {/* Sidebar */}
        <div className="hidden lg:flex">
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition-[width] duration-300 ease-out">
            <Sidebar
              onToggleNotes={toggleNotes}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>
        </div>

        {/* Main calendar */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <MainArea
            settingsMounted={settingsTransition.mounted}
            settingsExiting={settingsTransition.exiting}
          />
        </main>

        {/* Notes rail — hidden while the Settings page is on screen, including
            while it animates away, so the rail never appears beside the fading
            panel. Its own open state is never touched, so it returns as the
            user left it. */}
        {notesOpen && !settingsTransition.mounted && (
          <div className="hidden xl:flex">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <NotesPanel />
            </div>
          </div>
        )}
      </div>

      <EventModal />

      {/* Mobile drawers */}
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

export default function App({ screen }: { screen?: Screen } = {}) {
  return (
    <ScreenProvider initialScreen={screen ?? 'app'}>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ScreenProvider>
  )
}