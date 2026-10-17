import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Calendar, CalendarEvent, Note, Settings, SlotNote, ViewMode } from './lib/types'
import { splitLegacyNotes } from './lib/slots'
import type { EventColorId } from './lib/colors'
import { AUTO_COLORS } from './lib/colors'
import { DEFAULT_SETTINGS } from './lib/seed'
import { addDays, addMonths, startOfDay } from './lib/date'
import { uid } from './lib/id'
import { useProjectSync } from './sync'
import type { SaveStatus, Workspace } from './sync'

export interface ModalState {
  mode: 'create' | 'edit'
  event: CalendarEvent
}

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
  /** Whether the Settings page is open in the main content area. */
  settingsOpen: boolean
  /** Which section of the Settings page is showing. */
  settingsSection: SettingsSectionId
  setSettingsSection: (section: SettingsSectionId) => void
  openSettings: (section?: SettingsSectionId) => void
  closeSettings: () => void

  /** Whether the latest change has reached the server. */
  saveStatus: SaveStatus
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

  modal: ModalState | null
  openCreate: (start: Date, durationMin?: number, calendarId?: string) => void
  openEdit: (event: CalendarEvent) => void
  closeModal: () => void
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void

  addCalendar: () => void
  updateCalendar: (id: string, patch: Partial<Omit<Calendar, 'id'>>) => void
  deleteCalendar: (id: string) => void
  toggleCalendar: (id: string) => void

  /** Calendar time-slot notes (System A). Separate from `notes`. */
  slotNotes: SlotNote[]
  addSlotNote: (note: Omit<SlotNote, 'createdAt'>) => void
  updateSlotNote: (id: string, patch: Partial<Pick<SlotNote, 'title'>>) => void
  deleteSlotNote: (id: string) => void

  /** Notes panel filter (a yyyy-mm-dd day) and a request to open the panel. */
  notesFilter: string | null
  setNotesFilter: (date: string | null) => void
  notesOpenRequest: number
  openNotesFor: (date: string | null) => void

  addNote: (patch?: Partial<Note>) => void
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  moveNote: (from: number, to: number) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export type ProjectData = Workspace<CalendarEvent, Calendar, Note, Partial<Settings>> & {
  slotNotes?: SlotNote[]
}

/**
 * One project's calendar: its events, calendars, notes and settings. The data
 * is loaded from the server before this mounts and every change is saved back
 * to that project only — nothing is shared between projects.
 */
export function AppProvider({
  children,
  projectId,
  initial,
}: {
  children: ReactNode
  /** The open project. Omitted only in tests, where nothing is saved. */
  projectId?: string
  initial: ProjectData
}) {
  const [events, setEvents] = useState<CalendarEvent[]>(initial.events)
  const [calendars, setCalendars] = useState<Calendar[]>(initial.calendars)
  // Split any older mixed note list into documents and time-slot notes once.
  const [split] = useState(() => splitLegacyNotes(initial.notes, initial.slotNotes))
  const [notes, setNotes] = useState<Note[]>(split.notes)
  const [slotNotes, setSlotNotes] = useState<SlotNote[]>(split.slotNotes)
  const [notesFilter, setNotesFilter] = useState<string | null>(null)
  const [notesOpenRequest, setNotesOpenRequest] = useState(0)
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...initial.settings,
  }))

  const workspace = useMemo(
    () => ({ events, calendars, notes, slotNotes, settings }),
    [events, calendars, notes, slotNotes, settings],
  )
  const saveStatus = useProjectSync(projectId, workspace)

  const [view, setViewState] = useState<ViewMode>(() => settings.defaultView)
  const [focusDay, setFocusDay] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date()),
  )
  const [modal, setModal] = useState<ModalState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] =
    useState<SettingsSectionId>('profile')

  const openSettings = useCallback((target?: SettingsSectionId) => {
    if (target) setSettingsSection(target)
    setSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [setSettings],
  )

  const selectDate = useCallback((date: Date) => setSelectedDate(startOfDay(date)), [])

  /** Changing view clears the single-day focus, so Full Week always shows 7 days. */
  const setView = useCallback((next: ViewMode) => {
    setViewState(next)
    setFocusDay(false)
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

  const openCreate = useCallback(
    (start: Date, durationMin = 60, calendarId?: string) => {
      const calendar = calendarId ?? calendars[0]?.id ?? 'cal_main'
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
        const owned = { ...event }
        delete owned.seeded
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

  const addSlotNote = useCallback(
    (note: Omit<SlotNote, 'createdAt'>) =>
      setSlotNotes((list) => [...list, { ...note, createdAt: Date.now() }]),
    [],
  )
  const updateSlotNote = useCallback(
    (id: string, patch: Partial<Pick<SlotNote, 'title'>>) =>
      setSlotNotes((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n))),
    [],
  )
  const deleteSlotNote = useCallback(
    (id: string) => setSlotNotes((list) => list.filter((n) => n.id !== id)),
    [],
  )
  const openNotesFor = useCallback((date: string | null) => {
    setNotesFilter(date)
    setNotesOpenRequest((n) => n + 1)
  }, [])

  const addNote = useCallback(
    (patch?: Partial<Note>) => {
      const note: Note = {
        id: uid('note'),
        title: '',
        body: '',
        createdAt: Date.now(),
        ...patch,
      }
      // Documents never carry a time, so they can never reach the grid.
      delete note.time
      setNotes((list) => [note, ...list])
    },
    [setNotes],
  )

  const updateNote = useCallback(
    (id: string, patch: Partial<Note>) => {
      const clean = { ...patch }
      delete clean.time
      setNotes((list) =>
        list.map((n) => (n.id === id ? { ...n, ...clean } : n)),
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
      slotNotes,
      addSlotNote,
      updateSlotNote,
      deleteSlotNote,
      notesFilter,
      setNotesFilter,
      notesOpenRequest,
      openNotesFor,
      settingsOpen,
      settingsSection,
      setSettingsSection,
      openSettings,
      closeSettings,
      saveStatus,
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
      modal,
      openCreate,
      openEdit,
      closeModal,
      saveEvent,
      deleteEvent,
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
      slotNotes,
      addSlotNote,
      updateSlotNote,
      deleteSlotNote,
      notesFilter,
      notesOpenRequest,
      openNotesFor,
      settingsOpen,
      settingsSection,
      openSettings,
      closeSettings,
      saveStatus,
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
      modal,
      openCreate,
      openEdit,
      closeModal,
      saveEvent,
      deleteEvent,
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

/** The calendar context when inside a project, or null elsewhere (e.g. the dashboard). */
export function useOptionalApp(): AppContextValue | null {
  return useContext(AppContext)
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
