import { useState } from 'react'
import { COLORS } from '../../lib/colors'
import { DEMO_DAYS, DEMO_EVENTS, DEMO_WEEKDAYS } from '../demo'
import { PREVIEW_TODAY } from '../today'

const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
const START = 8 * 60
const END = 18 * 60
const SPAN = END - START

/**
 * A close crop of a real Desknoty week (Tue–Fri, 8am–6pm). Selecting a day
 * opens its note beside the calendar. Thursday is selected to begin with, so
 * the composition reads even with motion off.
 */
export function HeroWeek() {
  const days = [1, 2, 3, 4]
  const [sel, setSel] = useState(3)
  const info = DEMO_DAYS[sel]
  return (
    <div className="lp-hw">
      <div className="lp-hw-cal" role="group" aria-label="Sample week. Choose a day to see its note.">
        <div className="lp-hw-head">
          <span className="lp-hw-month">{PREVIEW_TODAY.weekTitle}</span>
          <span className="lp-hw-tabs" aria-hidden="true">
            <i>Day</i>
            <i className="on">Week</i>
            <i>Month</i>
          </span>
        </div>
        <div className="lp-hw-grid">
          <div className="lp-hw-hours" aria-hidden="true">
            {[9, 11, 13, 15, 17].map((h) => (
              <span key={h} style={{ top: `${((h * 60 - START) / SPAN) * 100}%` }}>
                {h > 12 ? h - 12 : h}
                {h >= 12 ? 'pm' : 'am'}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={'lp-hw-day' + (sel === d ? ' on' : '')}
              aria-pressed={sel === d}
              aria-label={`${DEMO_WEEKDAYS[d]} ${PREVIEW_TODAY.weekNumbers[d]}`}
              onClick={() => setSel(d)}
            >
              <span className="lp-hw-dayname">
                {DEMO_WEEKDAYS[d]} <b>{PREVIEW_TODAY.weekNumbers[d]}</b>
              </span>
              <span className="lp-hw-col">
                {DEMO_EVENTS.filter((e) => e.day === d && e.start >= START && e.start < END).map((e) => {
                  const c = COLORS[e.color]
                  return (
                    <span
                      key={e.title}
                      className="lp-hw-ev"
                      style={{ top: `${((e.start - START) / SPAN) * 100}%`, height: `max(${(Math.min(e.duration, END - e.start) / SPAN) * 100}%, 38px)`, background: c.bg, borderColor: c.border, color: c.text }}
                    >
                      <b>{e.title}</b>
                      <small>{hhmm(e.start)}</small>
                    </span>
                  )
                })}
              </span>
            </button>
          ))}
        </div>
      </div>
      <aside key={sel} className="lp-hw-note" aria-live="polite">
        <span className="lp-hw-note-tag">
          {DEMO_WEEKDAYS[sel]} {PREVIEW_TODAY.weekNumbers[sel]} · Note
        </span>
        <p>{info.note}</p>
        <ul>
          {info.tasks.map((t) => (
            <li key={t.text} className={t.done ? 'done' : ''}>
              <span aria-hidden="true" />
              {t.text}
              <span className="sr-only">{t.done ? ' (done)' : ''}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
