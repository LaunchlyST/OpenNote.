import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Calendar, CalendarEvent, Note, Settings, ViewMode } from './lib/types'
import type { EventColorId } from './lib/colors'
import { AUTO_COLORS } from './lib/colors'
import {
  DEFAULT_SETTINGS,
  seedCalendars,
  seedEvents,
  seedNotes,
} from './lib/seed'
import { addDays, addMonths, dateKey, startOfDay, startOfWeek } from './lib/date'
import { uid } from './lib/id'
import { useLocalStorage } from './hooks'

export interface ModalState {
  mode: 'create' | 'edit'
  event: CalendarEvent
}

/**
 * Which sidebar navigation group is active.
 *
 * These are views onto the existing workspace rather than separate pages —
 * `dashboard` is the calendar itself, `calendar` is the month grid, and the
 * rest either move the selected date or focus the notes rail.
 */
export type NavSection =
  | 'dashboard'
  | 'calendar'
  | 'notes'
  | 'today'
  | 'upcoming'

/** The sections of the Settings page, in the order they appear in its nav. */
export type SettingsSectionId =
  | 'profile'
  | 'account'
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'calendar'
  | 'security'
  | 'billing'
  /** Admin-only. Gated by the server, not by this list. */
  | 'deploy'

interface AppContextValue {
  events: CalendarEvent[]
  calendars: Calendar[]
  notes: Note[]
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void

  view: ViewMode
  setView: (view: ViewMode) => void
  /** Full Week narrowed to a single chosen day (still the Full Week view). */
  focusDay: boolean
  focusOnDate: (date: Date) => void
  selectedDate: Date
  selectDate: (date: Date) => void
  navigate: (delta: number) => void
  goToToday: () => void

  /** Active sidebar navigation group. */
  section: NavSection
  setSection: (section: NavSection) => void
  openDashboard: () => void
  openCalendar: () => void
  openNotes: () => void
  openToday: () => void
  openUpcoming: () => void

  modal: ModalState | null
  openCreate: (start: Date, durationMin?: number, calendarId?: string) => void
  openEdit: (event: CalendarEvent) => void
  closeModal: () => void
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void

  /** Whether the Settings page is open in the main content area. */
  settingsOpen: boolean
  /** Which section of the Settings page is showing. */
  settingsSection: SettingsSectionId
  setSettingsSection: (section: SettingsSectionId) => void
  openSettings: (section?: SettingsSectionId) => void
  closeSettings: () => void

  /** Whether the left sidebar starts collapsed. Persisted with the settings. */
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void

  addCalendar: () => void
  updateCalendar: (id: string, patch: Partial<Omit<Calendar, 'id'>>) => void
  deleteCalendar: (id: string) => void
  toggleCalendar: (id: string) => void

  addNote: (patch?: Partial<Note>) => void
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  moveNote: (from: number, to: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const STORAGE = {
  events: 'opennote.events.v1',
  eventsWeek: 'opennote.events.week',
  calendars: 'opennote.calendars.v1',
  notes: 'opennote.notes.v1',
  settings: 'opennote.settings.v1',
}

/**
 * Demo events are generated relative to the week of the first visit and then
 * kept in localStorage forever, so once that week passes the current week
 * renders empty. Record which week the stored demo events belong to, and
 * repair storage when it no longer matches — keeping any event the user
 * created or edited.
 *
 * This has to run before `useLocalStorage` reads the key: that hook returns
 * an existing stored value without consulting its initializer, so a repair
 * passed in as the initial value would never execute.
 */
function syncStoredEvents() {
  const anchor = dateKey(startOfWeek(new Date(), DEFAULT_SETTINGS.weekStartsOn))
  try {
    const raw = window.localStorage.getItem(STORAGE.events)
    if (raw !== null && window.localStorage.getItem(STORAGE.eventsWeek) === anchor) {
      return
    }
    const kept = raw
      ? (JSON.parse(raw) as CalendarEvent[]).filter((e) => !e.seeded)
      : []
    window.localStorage.setItem(
      STORAGE.events,
      JSON.stringify([...seedEvents(), ...kept]),
    )
    window.localStorage.setItem(STORAGE.eventsWeek, anchor)
  } catch {
    /* storage blocked or corrupt - the hook falls back to demo data */
  }
}

syncStoredEvents()

export function AppProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(
    STORAGE.events,
    seedEvents,
  )
  const [calendars, setCalendars] = useLocalStorage<Calendar[]>(
    STORAGE.calendars,
    seedCalendars,
  )
  const [notes, setNotes] = useLocalStorage<Note[]>(STORAGE.notes, seedNotes)
  const [storedSettings, setSettings] = useLocalStorage<Partial<Settings>>(
    STORAGE.settings,
    DEFAULT_SETTINGS,
  )
  /**
   * Settings gained keys over time (`defaultView`, `reduceMotion`, …). A value
   * stored by an older build is merged over the defaults on read so a missing
   * key never comes back as `undefined`.
   */
  const settings = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, ...storedSettings }),
    [storedSettings],
  )

  const [view, setViewState] = useState<ViewMode>(settings.defaultView)
  const [focusDay, setFocusDay] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date()),
  )
  const [modal, setModal] = useState<ModalState | null>(null)
  const [section, setSection] = useState<NavSection>('dashboard')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>('profile')

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [setSettings],
  )

  const openSettings = useCallback((target?: SettingsSectionId) => {
    if (target) setSettingsSection(target)
    setSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  /**
   * `reduceMotion` is a whole-document preference rather than a prop, so it is
   * mirrored onto `<html>` where the animation classes can be neutralised.
   */
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
  }, [settings.reduceMotion])

  const selectDate = useCallback((date: Date) => setSelectedDate(startOfDay(date)), [])

  /** Changing view clears the single-day focus, so Full Week always shows 7 days. */
  const setView = useCallback((next: ViewMode) => {
    setViewState(next)
    setFocusDay(false)
    // The month grid is what the "Calendar" nav item means; everything else
    // is the workspace itself.
    setSection(next === 'month' ? 'calendar' : 'dashboard')
  }, [])

  /**
   * Clicking a day in Full Week narrows the grid to that one day, full width,
   * without leaving Full Week — the Full Week button stays selected and
   * pressing it again restores all seven columns.
   */
  const focusOnDate = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date))
    setFocusDay(true)
  }, [])

  const navigate = useCallback(
    (delta: number) => {
      setSelectedDate((prev) => {
        if (view === 'day') return addDays(prev, delta)
        if (view === 'week') return addDays(prev, delta * 7)
        return addMonths(prev, delta)
      })
    },
    [view],
  )

  const goToToday = useCallback(() => setSelectedDate(startOfDay(new Date())), [])

  /** The main workspace: a full week with the notes rail alongside it. */
  const openDashboard = useCallback(() => {
    setViewState('week')
    setFocusDay(false)
    setSection('dashboard')
    setSettingsOpen(false)
  }, [])

  /** The month grid — the existing calendar overview. */
  const openCalendar = useCallback(() => {
    setViewState('month')
    setFocusDay(false)
    setSection('calendar')
    setSettingsOpen(false)
  }, [])

  /** Focuses the notes rail without moving the calendar off the workspace. */
  const openNotes = useCallback(() => setSection('notes'), [])

  /** Today as a single-day agenda. */
  const openToday = useCallback(() => {
    setSelectedDate(startOfDay(new Date()))
    setViewState('day')
    setFocusDay(false)
    setSection('today')
  }, [])

  /** The upcoming-events list. */
  const openUpcoming = useCallback(() => setSection('upcoming'), [])

  const sidebarCollapsed = settings.sidebarCollapsed
  const setSidebarCollapsed = useCallback(
    (collapsed: boolean) => updateSettings({ sidebarCollapsed: collapsed }),
    [updateSettings],
  )

  const openCreate = useCallback(
    (start: Date, durationMin = 60, calendarId?: string) => {
      const calendar = calendarId ?? calendars[0]?.id ?? 'cal_work'
      const end = new Date(start.getTime() + durationMin * 60_000)
      setModal({
        mode: 'create',
        event: {
          id: uid('evt'),
          title: '',
          start: start.toISOString(),
          end: end.toISOString(),
          calendarId: calendar,
        },
      })
    },
    [calendars],
  )

  const openEdit = useCallback((event: CalendarEvent) => {
    setModal({ mode: 'edit', event })
  }, [])

  const closeModal = useCallback(() => setModal(null), [])

  const saveEvent = useCallback(
    (event: CalendarEvent) => {
      setEvents((list) => {
        // Clearing `seeded` makes an edited event user-owned, so it survives
        // the weekly demo-data refresh.
        const owned = { ...event, seeded: false }
        const idx = list.findIndex((e) => e.id === owned.id)
        if (idx === -1) return [...list, owned]
        const next = [...list]
        next[idx] = owned
        return next
      })
      setModal(null)
    },
    [setEvents],
  )

  const deleteEvent = useCallback(
    (id: string) => {
      setEvents((list) => list.filter((e) => e.id !== id))
      setModal(null)
    },
    [setEvents],
  )

  const addCalendar = useCallback(() => {
    setCalendars((list) => {
      const color: EventColorId = AUTO_COLORS[list.length % AUTO_COLORS.length]
      return [
        ...list,
        {
          id: uid('cal'),
          name: `Calendar ${list.length + 1}`,
          color,
          visible: true,
        },
      ]
    })
  }, [setCalendars])

  const updateCalendar = useCallback(
    (id: string, patch: Partial<Omit<Calendar, 'id'>>) => {
      setCalendars((list) =>
        list.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      )
    },
    [setCalendars],
  )

  const deleteCalendar = useCallback(
    (id: string) => {
      setCalendars((list) => list.filter((c) => c.id !== id))
      setEvents((list) => list.filter((e) => e.calendarId !== id))
    },
    [setCalendars, setEvents],
  )

  const toggleCalendar = useCallback(
    (id: string) => {
      setCalendars((list) =>
        list.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
      )
    },
    [setCalendars],
  )

  const addNote = useCallback(
    (patch?: Partial<Note>) => {
      const note: Note = {
        id: uid('note'),
        title: '',
        body: '',
        createdAt: Date.now(),
        ...patch,
      }
      setNotes((list) => [note, ...list])
    },
    [setNotes],
  )

  const updateNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      setNotes((list) =>
        list.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      )
    },
    [setNotes],
  )

  const deleteNote = useCallback(
    (id: string) => setNotes((list) => list.filter((n) => n.id !== id)),
    [setNotes],
  )

  const moveNote = useCallback(
    (from: number, to: number) => {
      setNotes((list) => {
        if (
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= list.length ||
          to >= list.length
        ) {
          return list
        }
        const next = [...list]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
    },
    [setNotes],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      events,
      calendars,
      notes,
      settings,
      updateSettings,
      view,
      setView,
      focusDay,
      focusOnDate,
      selectedDate,
      selectDate,
      navigate,
      goToToday,
      section,
      setSection,
      openDashboard,
      openCalendar,
      openNotes,
      openToday,
      openUpcoming,
      modal,
      openCreate,
      openEdit,
      closeModal,
      saveEvent,
      deleteEvent,
      settingsOpen,
      settingsSection,
      setSettingsSection,
      openSettings,
      closeSettings,
      sidebarCollapsed,
      setSidebarCollapsed,
      addCalendar,
      updateCalendar,
      deleteCalendar,
      toggleCalendar,
      addNote,
      updateNote,
      deleteNote,
      moveNote,
    }),
    [
      events,
      calendars,
      notes,
      settings,
      updateSettings,
      view,
      setView,
      focusDay,
      focusOnDate,
      selectedDate,
      selectDate,
      navigate,
      goToToday,
      section,
      setSection,
      openDashboard,
      openCalendar,
      openNotes,
      openToday,
      openUpcoming,
      modal,
      openCreate,
      openEdit,
      closeModal,
      saveEvent,
      deleteEvent,
      settingsOpen,
      settingsSection,
      setSettingsSection,
      openSettings,
      closeSettings,
      sidebarCollapsed,
      setSidebarCollapsed,
      addCalendar,
      updateCalendar,
      deleteCalendar,
      toggleCalendar,
      addNote,
      updateNote,
      deleteNote,
      moveNote,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
