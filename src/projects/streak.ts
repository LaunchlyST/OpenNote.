import { useEffect, useState } from 'react'

/**
 * Daily streak: consecutive days the app was opened in this browser.
 *
 * Kept in localStorage, so it works the same with or without the API. A day
 * counts the first time the dashboard opens that day. Missing a day resets
 * the streak — unless a streak freeze (earned at 60 days, refilled every 30
 * days after) covers exactly one missed day.
 */

export interface Milestone {
  days: number
  title: string
  reward: string
  /** Theme id this unlocks, if any. */
  theme?: string
  badge?: string
}

export const MILESTONES: Milestone[] = [
  { days: 1, title: 'Day 1', reward: 'Your streak flame is lit', badge: '🔥' },
  { days: 3, title: '3 days', reward: 'Unlocks the Sunset theme', theme: 'sunset' },
  { days: 7, title: '1 week', reward: '“1 week” badge and a confetti moment', badge: '⭐' },
  { days: 14, title: '2 weeks', reward: 'Unlocks the Gold theme', theme: 'gold' },
  { days: 30, title: '30 days', reward: 'Glowing avatar ring and the Aurora theme', theme: 'aurora', badge: '💎' },
  { days: 60, title: '60 days', reward: 'A streak freeze: miss one day safely (refills every 30 days)' },
  { days: 100, title: '100 days', reward: '“Centurion” badge and an animated flame', badge: '🏆' },
  { days: 365, title: '1 year', reward: '“Legend” crown badge and the Legend theme', theme: 'legend', badge: '👑' },
]

interface State {
  last: string // yyyy-mm-dd of the last counted day
  count: number
  best: number
  freezes: number
  freezeAt: number // streak length when the freeze was last refilled
  celebrated: number // highest milestone already celebrated
}

const KEY = 'desknoty.streak.v1'
const EVENT = 'desknoty:streak'
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86_400_000)

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s && typeof s.count === 'number') return s
  } catch {
    /* fresh */
  }
  return { last: '', count: 0, best: 0, freezes: 0, freezeAt: 0, celebrated: 0 }
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage blocked: the streak lasts this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Counts today. Returns the milestone reached today, if one is new. */
export function recordVisit(today = new Date()): Milestone | null {
  const s = load()
  const t = ymd(today)
  if (s.last === t) return null
  const gap = s.last ? daysBetween(s.last, t) : Infinity
  if (gap === 1) s.count += 1
  else if (gap === 2 && s.freezes > 0) {
    s.freezes -= 1 // the freeze covers the missed day
    s.count += 1
  } else s.count = 1
  s.last = t
  s.best = Math.max(s.best, s.count)
  // freezes: the first at 60 days, then one more for every 30 days after
  if (s.count >= 60 && s.count - Math.max(s.freezeAt, 30) >= 30) {
    s.freezes = Math.min(1, s.freezes + 1)
    s.freezeAt = s.count
  }
  const hit = [...MILESTONES].reverse().find((m) => m.days <= s.count && m.days > s.celebrated) ?? null
  if (hit) s.celebrated = hit.days
  save(s)
  return hit && hit.days === s.count ? hit : null
}

export function useStreak() {
  const [s, setS] = useState(load)
  useEffect(() => {
    const sync = () => setS(load())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return s
}

/** The best (most recent) milestone reached, for badges. */
export function topMilestone(count: number) {
  return [...MILESTONES].reverse().find((m) => m.days <= count && m.badge)
}

export function themeUnlocked(id: string, count: number) {
  const m = MILESTONES.find((x) => x.theme === id)
  return !m || count >= m.days
}

export function themeNeeds(id: string) {
  return MILESTONES.find((x) => x.theme === id)?.days
}
