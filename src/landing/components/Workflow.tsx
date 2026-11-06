import { COLORS } from '../../lib/colors'
import { Reveal } from './primitives'
import { PREVIEW_TODAY } from '../today'

/** Three small purpose-built scenes: plan a day, add a task, capture a note. */
export function Workflow() {
  const lime = COLORS.lime
  const purple = COLORS.purple
  return (
    <section id="how-it-works" className="lp-wf px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-[1120px]">
        <Reveal>
          <p className="lp-eyebrow">How a day goes</p>
          <h2 className="lp-h2">Three moves. One place.</h2>
        </Reveal>
        <div className="lp-wf-grid">
          <Reveal as="figure" className="lp-wf-item">
            <div className="lp-scene lp-scene-plan" aria-hidden="true">
              <div className="lp-sp-row"><span>9:00</span><i style={{ background: lime.bg, borderColor: lime.border, color: lime.text }}>Morning planning</i></div>
              <div className="lp-sp-row"><span>10:00</span><i className="lp-sp-drop">Drop a block here</i></div>
              <div className="lp-sp-row"><span>11:30</span><i style={{ background: purple.bg, borderColor: purple.border, color: purple.text, height: 52 }}>Design review</i></div>
            </div>
            <figcaption><b>Plan the day.</b> Drag time blocks onto the hours they need.</figcaption>
          </Reveal>
          <Reveal as="figure" className="lp-wf-item" delay={80}>
            <div className="lp-scene lp-scene-task" aria-hidden="true">
              <div className="lp-st-input">Reply to Sam about the invoice<span className="lp-caret" /></div>
              <ul>
                <li className="done"><span />Send agenda</li>
                <li><span />Review mockups</li>
              </ul>
              <small>Due Thursday</small>
            </div>
            <figcaption><b>Add a task.</b> Type it, give it a day, tick it off.</figcaption>
          </Reveal>
          <Reveal as="figure" className="lp-wf-item" delay={160}>
            <div className="lp-scene lp-scene-note" aria-hidden="true">
              <div className="lp-sn-date"><b>{PREVIEW_TODAY.weekNumbers[3]}</b><span>Thu</span></div>
              <div className="lp-sn-paper">
                <p>Chapter 4 summary for the study group.</p>
                <p>Marketing wants numbers by 5.</p>
              </div>
            </div>
            <figcaption><b>Capture a note.</b> It stays pinned to the day it belongs to.</figcaption>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
