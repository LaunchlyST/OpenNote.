import { useEffect, useState } from 'react'
import { COLORS } from '../../lib/colors'
import { DEMO_DAYS, DEMO_EVENTS, DEMO_WEEKDAYS } from '../demo'
import { PREVIEW_TODAY } from '../today'
import { Reveal } from './primitives'

/**
 * The product demo: a sample week that behaves like the app. View tabs live
 * in the toolbar; the selected day's plan, tasks and note sit in the same
 * frame. Demo data comes from ../demo only and is never saved. Narrow
 * screens get a day agenda instead of a shrunken desktop window.
 */
type View = 'day' | 'week' | 'month'
const TABS: Array<{ v: View; label: string }> = [
  { v: 'day', label: 'Day' },
  { v: 'week', label: 'Full Week' },
  { v: 'month', label: 'Month' },
]
const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const START = 8 * 60
const END = 21 * 60
const SPAN = END - START
const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

function useNarrow() {
  const [n, setN] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const set = () => setN(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])
  return n
}

function Ev({ e }: { e: (typeof DEMO_EVENTS)[number] }) {
  const c = COLORS[e.color]
  return (
    <span
      className="lp-dm-ev"
      style={{ top: `${((e.start - START) / SPAN) * 100}%`, height: `max(${(e.duration / SPAN) * 100}%, 30px)`, background: c.bg, borderColor: c.border, color: c.text }}
    >
      <b>{e.title}</b>
      <small>{hhmm(e.start)}</small>
    </span>
  )
}

export function ProductPreview() {
  const narrow = useNarrow()
  const [view, setView] = useState<View>('week')
  const [day, setDay] = useState(3) // Thursday: the fullest day
  const [tasks, setTasks] = useState(() => DEMO_DAYS.map((d) => d.tasks.map((t) => ({ ...t }))))
  const shown: View = narrow && view === 'week' ? 'day' : view
  const events = DEMO_EVENTS.filter((e) => e.day === day).sort((a, b) => a.start - b.start)
  const title =
    shown === 'month' ? `${PREVIEW_TODAY.monthName} ${PREVIEW_TODAY.year}` : shown === 'day' ? `${LONG[day]} ${PREVIEW_TODAY.weekNumbers[day]}` : PREVIEW_TODAY.weekTitle
  const toggle = (i: number) => setTasks((all) => all.map((d, di) => (di !== day ? d : d.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))))

  return (
    <section id="preview" className="lp-demo px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-[1120px]">
        <Reveal>
          <p className="lp-eyebrow">Demo</p>
          <h2 className="lp-h2">Try it with a sample week.</h2>
          <p className="lp-lede">Pick a day to see its plan, tasks and note. Switch views from the toolbar. No account needed.</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="lp-dm" role="region" aria-label="Desknoty demo with sample data">
            <div className="lp-dm-bar">
              <b className="lp-dm-title" aria-live="polite">{title}</b>
              <div className="lp-dm-tabs" role="group" aria-label="Calendar view">
                {TABS.map((t) => (
                  <button key={t.v} type="button" aria-pressed={view === t.v} className={view === t.v ? 'on' : ''} onClick={() => setView(t.v)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-dm-strip" role="group" aria-label="Choose a day">
              {DEMO_WEEKDAYS.map((w, i) => (
                <button key={w} type="button" aria-pressed={day === i} className={day === i ? 'on' : ''} onClick={() => setDay(i)}>
                  <small>{w}</small>
                  <b>{PREVIEW_TODAY.weekNumbers[i]}</b>
                </button>
              ))}
            </div>

            <div className="lp-dm-main">
              <div className="lp-dm-cal">
                {shown === 'week' && (
                  <div className="lp-dm-week">
                    {DEMO_WEEKDAYS.map((w, i) => (
                      <button key={w} type="button" className={'lp-dm-col' + (day === i ? ' on' : '')} aria-label={`${LONG[i]} ${PREVIEW_TODAY.weekNumbers[i]}`} aria-pressed={day === i} onClick={() => setDay(i)}>
                        {DEMO_EVENTS.filter((e) => e.day === i).map((e) => (
                          <Ev key={e.title} e={e} />
                        ))}
                      </button>
                    ))}
                  </div>
                )}
                {shown === 'day' && (
                  <ol className="lp-dm-agenda">
                    {events.map((e) => (
                      <li key={e.title} style={{ borderColor: COLORS[e.color].border, background: COLORS[e.color].bg, color: COLORS[e.color].text }}>
                        <time>
                          {hhmm(e.start)} – {hhmm(e.start + e.duration)}
                        </time>
                        <b>{e.title}</b>
                      </li>
                    ))}
                  </ol>
                )}
                {shown === 'month' && (
                  <div className="lp-dm-month">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <span key={i} className="lp-dm-mh">{d}</span>
                    ))}
                    {PREVIEW_TODAY.miniCells.map((c) => {
                      const wi = PREVIEW_TODAY.weekKeys.indexOf(c.key)
                      const dots = wi >= 0 ? DEMO_EVENTS.filter((e) => e.day === wi) : []
                      return wi >= 0 ? (
                        <button key={c.key} type="button" className={'lp-dm-cell in' + (day === wi ? ' on' : '')} aria-pressed={day === wi} aria-label={`${LONG[wi]} ${c.n}`} onClick={() => setDay(wi)}>
                          <b>{c.n}</b>
                          <span>
                            {dots.map((e) => (
                              <i key={e.title} style={{ background: COLORS[e.color].dot }} />
                            ))}
                          </span>
                        </button>
                      ) : (
                        <span key={c.key} className={'lp-dm-cell' + (c.inMonth ? '' : ' out')}>
                          <b>{c.n}</b>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              <aside className="lp-dm-side" aria-label={`${LONG[day]} details`}>
                <h3>
                  {LONG[day]} <span>{PREVIEW_TODAY.weekNumbers[day]}</span>
                </h3>
                <h4>Plan</h4>
                <ul className="lp-dm-plan">
                  {events.map((e) => (
                    <li key={e.title}>
                      <i style={{ background: COLORS[e.color].dot }} />
                      <time>{hhmm(e.start)}</time>
                      {e.title}
                    </li>
                  ))}
                </ul>
                <h4>Tasks</h4>
                <ul className="lp-dm-tasks">
                  {tasks[day].map((t, i) => (
                    <li key={t.text}>
                      <label>
                        <input type="checkbox" checked={t.done} onChange={() => toggle(i)} />
                        <span className={t.done ? 'done' : ''}>{t.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <h4>Note</h4>
                <p className="lp-dm-note">{DEMO_DAYS[day].note}</p>
              </aside>
            </div>
          </div>
          <p className="lp-small">Sample data only. This demo isn’t connected to an account and can’t change your calendar.</p>
        </Reveal>
      </div>
    </section>
  )
}
