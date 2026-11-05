import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Lock, Snowflake } from 'lucide-react'
import { cn } from '../lib/id'
import { MILESTONES, recordVisit, topMilestone, useStreak } from './streak'
import type { Milestone } from './streak'

/** Flame + day count; opens the rewards ladder. Counts today on mount. */
export function StreakChip({ className }: { className?: string }) {
  const s = useStreak()
  const [open, setOpen] = useState(false)
  const [party, setParty] = useState<Milestone | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const hit = recordVisit()
    if (hit) setParty(hit)
  }, [])
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const next = MILESTONES.find((m) => m.days > s.count)
  const prev = [...MILESTONES].reverse().find((m) => m.days <= s.count)?.days ?? 0
  const pct = next ? (s.count - prev) / (next.days - prev) : 1
  const top = topMilestone(s.count)

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${s.count} day streak. Show rewards`}
        className={cn('sk-chip', s.count >= 100 && 'sk-chip-hot')}
      >
        <span className="sk-flame" aria-hidden="true">
          🔥
        </span>
        <b>{s.count}</b>
        {top && top.badge !== '🔥' && <span aria-hidden="true">{top.badge}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Your streak" className="sk-pop">
          <div className="sk-pop-head">
            <span className="sk-big">🔥 {s.count}</span>
            <span>
              day{s.count === 1 ? '' : 's'} in a row
              <small>Best: {s.best}</small>
            </span>
          </div>
          {next && (
            <div className="sk-next">
              <div className="sk-bar">
                <span style={{ width: `${Math.max(4, pct * 100)}%` }} />
              </div>
              <p>
                {next.days - s.count} more day{next.days - s.count === 1 ? '' : 's'} to <b>{next.title}</b>: {next.reward}
              </p>
            </div>
          )}
          {s.freezes > 0 && (
            <p className="sk-freeze">
              <Snowflake className="h-3.5 w-3.5" /> Streak freeze ready: you can miss one day.
            </p>
          )}
          <ol className="sk-list">
            {MILESTONES.map((m) => {
              const got = s.count >= m.days || s.best >= m.days
              return (
                <li key={m.days} className={cn(got && 'sk-got')}>
                  <span className="sk-ico">{got ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</span>
                  <span className="sk-day">{m.title}</span>
                  <span className="sk-reward">{m.reward}</span>
                </li>
              )
            })}
          </ol>
          <p className="sk-note">Open Desknoty once a day to keep it going. Saved in this browser.</p>
        </div>
      )}

      {party && <Celebrate milestone={party} onDone={() => setParty(null)} />}
    </div>
  )
}

function Celebrate({ milestone, onDone }: { milestone: Milestone; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 5200)
    return () => window.clearTimeout(id)
  }, [onDone])
  const bits = milestone.days >= 7 ? 46 : 0
  return (
    <div className="sk-party" role="status" aria-live="polite">
      {Array.from({ length: bits }, (_, i) => (
        <i
          key={i}
          style={
            {
              left: `${(i * 37) % 100}%`,
              background: ['#c4f27a', '#f97316', '#38bdf8', '#f43f5e', '#facc15'][i % 5],
              animationDelay: `${(i % 9) * 0.07}s`,
              '--r': `${(i * 53) % 360}deg`,
            } as CSSProperties
          }
        />
      ))}
      <div className="sk-toast">
        <span className="text-[26px]">{milestone.badge ?? '🔥'}</span>
        <span>
          <strong>{milestone.title} streak!</strong>
          {milestone.reward}
        </span>
        <button type="button" onClick={onDone} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  )
}
