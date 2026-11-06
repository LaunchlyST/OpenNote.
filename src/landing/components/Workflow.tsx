import { COLORS } from '../../lib/colors'
import { PREVIEW_TODAY } from '../today'
import { Reveal } from './primitives'

/**
 * How it works: one Thursday, three steps. The same study block runs through
 * all three: it goes on the calendar, its task gets ticked, then a note is
 * pinned to that day.
 */
export function Workflow() {
  const thu = PREVIEW_TODAY.weekNumbers[3]
  const purple = COLORS.purple
  return (
    <section id="how-it-works" className="lp-wf px-4 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-[1120px]">
        <Reveal>
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2">One day, three steps.</h2>
        </Reveal>
        <ol className="lp-wf-steps">
          <Reveal as="li" className="lp-wf-step">
            <span className="lp-wf-n">1</span>
            <div className="lp-scene lp-s1" aria-hidden="true">
              <div className="lp-s1-head">Thu {thu}</div>
              <div className="lp-s1-rows">
                <span>9:00</span>
                <span>10:00</span>
                <span>11:00</span>
              </div>
              <i className="lp-s1-block" style={{ background: purple.bg, borderColor: purple.border, color: purple.text }}>
                <b>Study session</b>
                <small>9:30 – 11:00</small>
              </i>
            </div>
            <p><b>Block the time.</b> Drop a study session onto Thursday morning.</p>
          </Reveal>
          <Reveal as="li" className="lp-wf-step" delay={80}>
            <span className="lp-wf-n">2</span>
            <div className="lp-scene lp-s2" aria-hidden="true">
              <div className="lp-s2-tag" style={{ background: purple.bg, color: purple.text }}>Study session · 9:30</div>
              <ul>
                <li className="done"><span />Summarise chapter 4</li>
                <li><span />Pull signup numbers</li>
              </ul>
            </div>
            <p><b>Tick the task.</b> Chapter 4 summarised, straight from the block.</p>
          </Reveal>
          <Reveal as="li" className="lp-wf-step" delay={160}>
            <span className="lp-wf-n">3</span>
            <div className="lp-scene lp-s3" aria-hidden="true">
              <div className="lp-sn-date"><b>{thu}</b><span>Thu</span></div>
              <div className="lp-sn-paper">
                <span className="lp-s3-pin" />
                <p>Study group wants the summary by Friday.</p>
              </div>
            </div>
            <p><b>Pin the thought.</b> The note stays with Thursday, where you’ll look for it.</p>
          </Reveal>
        </ol>
      </div>
    </section>
  )
}
