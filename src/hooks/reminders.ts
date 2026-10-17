import { useEffect } from 'react'
import type { CalendarEvent } from '../lib/types'
import type { Preferences } from '../preferences'

/** True when `date` falls inside the quiet-hours window (which may wrap past midnight). */
export function inQuietHours(date: Date, p: Pick<Preferences, 'quietHours' | 'quietStart' | 'quietEnd'>): boolean {
  if (!p.quietHours) return false
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const m = date.getHours() * 60 + date.getMinutes()
  const a = toMin(p.quietStart)
  const b = toMin(p.quietEnd)
  return a === b ? false : a < b ? m >= a && m < b : m >= a || m < b
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
}

/**
 * Event reminders, delivered as browser notifications while OpenNote is open.
 * Only real events are scheduled (never notes), only with the browser's
 * permission, and never inside quiet hours. Nothing is sent from the server.
 */
export function useEventReminders(events: CalendarEvent[], prefs: Preferences) {
  useEffect(() => {
    if (!prefs.remindersEnabled || notificationPermission() !== 'granted') return
    const now = Date.now()
    const horizon = now + 24 * 3600_000
    const timers: number[] = []
    for (const ev of events) {
      const start = Date.parse(ev.start)
      const at = start - prefs.reminderLead * 60_000
      if (!(start > now && start <= horizon && at > now)) continue
      timers.push(
        window.setTimeout(() => {
          if (inQuietHours(new Date(), prefs)) return
          try {
            new Notification(ev.title || 'Untitled event', {
              body: `Starts in ${prefs.reminderLead} minutes`,
              tag: `opennote-${ev.id}-${ev.start}`,
            })
          } catch {
            /* the browser refused; nothing to do */
          }
        }, at - now),
      )
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [events, prefs])
}
