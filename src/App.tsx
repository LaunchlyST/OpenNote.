import { useEffect, useMemo, useState } from 'react'
import { AppProvider, useApp } from './store'
import type { ProjectData } from './store'
import { useRouter } from './router'
import { WorkspacePicker } from './projects/WorkspacePicker'
import { ProjectDashboard } from './projects/ProjectDashboard'
import { PageChrome, Spinner, btn } from './projects/Chrome'
import { ProjectContext } from './projects/context'
import { ApiError, parseWorkspaceRoute, paths, projectsApi } from './projects/api'
import type { ProjectSummary } from './projects/api'
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
import { SettingsPage } from './components/SettingsPage'
import { SETTINGS_TRANSITION_MS, useEscape, useExitTransition, useMediaQuery } from './hooks'
import { cn } from './lib/id'
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

/** The existing OpenNote calendar UI, for whichever project is loaded. */
function CalendarShell() {
  const { goToToday, setView, navigate, settingsOpen, closeSettings, notesOpenRequest } = useApp()
  // Settings opens in the main content area, over the calendar (which stays
  // mounted underneath, so closing it returns to the same view and scroll).
  const settingsTransition = useExitTransition(settingsOpen, SETTINGS_TRANSITION_MS)
  useEscape(settingsOpen, closeSettings)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

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

  // A day's "Notes (n)" badge asks for the Notes section: open whichever
  // notes surface is visible at this width (the store holds the filter).
  useEffect(() => {
    if (!notesOpenRequest) return
    closeSettings()
    if (wide) setNotesOpen(true)
    else setRightOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesOpenRequest])

  useEffect(() => {
    if (settingsOpen) return
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
  }, [navigate, goToToday, setView, settingsOpen])

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      <div className="hidden lg:flex">
        <Sidebar onToggleNotes={toggleNotes} notesOpen={notesOpen} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleLeft={() => setLeftOpen((o) => !o)}
          onToggleNotes={toggleNotes}
          notesOpen={wide ? notesOpen : rightOpen}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <MainArea />
            {settingsTransition.mounted && (
              <div
                className={cn(
                  'absolute inset-0 z-20 flex flex-col bg-canvas-warm',
                  settingsTransition.exiting ? 'settings-exit' : 'settings-enter',
                )}
              >
                <SettingsPage onBack={closeSettings} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Notes stay out of the way until asked for. */}
      {notesOpen && !settingsTransition.mounted && (
        <div className="animate-rise hidden border-l border-[#ececea] bg-[#fbfbfa] xl:flex">
          <NotesPanel />
        </div>
      )}

      <EventModal />

      {leftOpen && (
        <Drawer side="left" onClose={() => setLeftOpen(false)}>
          <Sidebar onToggleNotes={toggleNotes} notesOpen={rightOpen} />
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

/** Renders one project's calendar from already-loaded data. Also used by tests. */
export function ProjectCalendar({
  project,
  data,
  persist = true,
}: {
  project: ProjectSummary
  data: ProjectData
  persist?: boolean
}) {
  return (
    <ProjectContext.Provider value={project}>
      <AppProvider key={project.id} projectId={persist ? project.id : undefined} initial={data}>
        <CalendarShell />
      </AppProvider>
    </ProjectContext.Provider>
  )
}

/** Loads a project the signed-in user owns, then opens its calendar. */
function ProjectView({ id }: { id: string }) {
  const { navigate } = useRouter()
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string; missing: boolean }
    | { status: 'ready'; project: ProjectSummary; data: ProjectData }
  >({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    projectsApi
      .open(id)
      .then(({ project, data }) => alive && setState({ status: 'ready', project, data }))
      .catch(
        (e: Error) =>
          alive &&
          setState({
            status: 'error',
            message: e.message,
            missing: e instanceof ApiError && (e.status === 404 || e.status === 403),
          }),
      )
    return () => {
      alive = false
    }
  }, [id, attempt])

  if (state.status === 'ready') return <ProjectCalendar project={state.project} data={state.data} />
  if (state.status === 'loading')
    return (
      <PageChrome>
        <Spinner label="Opening your project…" />
      </PageChrome>
    )
  return (
    <PageChrome>
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-[20px] font-semibold text-[#191919]">
          {state.missing ? 'This project isn’t available' : 'Couldn’t open this project'}
        </h1>
        <p className="mt-2 text-[14px] text-[#6b6a66]">{state.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          {!state.missing && (
            <button type="button" className={btn.secondary} onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
          <button type="button" className={btn.primary} onClick={() => navigate(paths.picker)}>
            Back to Projects
          </button>
        </div>
      </div>
    </PageChrome>
  )
}

function Shell() {
  const { screen } = useScreen()
  const { path } = useRouter()

  if (screen === 'signin' || screen === 'signup' || screen === 'forgot' || screen === 'reset') {
    return <AuthPage />
  }
  if (screen === 'account') return <AccountSettings />

  // Sign In → Choose workspace → My Projects → a project's calendar.
  const route = parseWorkspaceRoute(path) ?? { kind: 'picker' as const }
  if (route.kind === 'dashboard') return <ProjectDashboard key={route.workspace} workspace={route.workspace} />
  if (route.kind === 'project') return <ProjectView key={route.id} id={route.id} />
  return <WorkspacePicker />
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
  const { path: routerPath } = useRouter()
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
    const path =
      screen === 'app' && parseWorkspaceRoute(routerPath) ? routerPath : SCREEN_PATHS[screen]
    if (path && window.location.pathname !== path) {
      window.history.replaceState(null, '', path)
    }
  }, [screen, routerPath])

  if (needsUser && !user) return <SessionCheck />
  // Remount per account so one user's projects never leak into another's.
  return <Shell key={user?.id ?? 'guest'} />
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
