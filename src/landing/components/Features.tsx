import { CalendarDays, Compass, LayoutGrid, Palette, Plus, StickyNote } from 'lucide-react'
import { FEATURES } from '../content'
import { FeatureCard, Reveal, Section, SectionHeading } from './primitives'

const ICON = 'h-5 w-5'

/** Captured from the running app, using scripts/capture-landing.cjs. */
function ProductImage({ screen, alt }: { screen: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-t-[12px] border border-b-0 border-black/[0.08] bg-white shadow-[0_-8px_30px_-18px_rgba(0,0,0,0.25)]">
      <img src={`/landing/app-${screen}.png?v=20261018-current`} alt={alt} width={1920} height={1200} loading="lazy" draggable={false} className="block h-auto w-full" />
    </div>
  )
}

export function Features() {
  return (
    <Section id="features">
      <Reveal>
        <SectionHeading icon={<CalendarDays className="h-6 w-6" />} tint="#d8ebff" heading="Your calendar and notes, finally together." description={FEATURES.description} />
      </Reveal>
      <div data-anim="assemble" className="mt-14 grid gap-4 md:mt-16">
        <Reveal data-anim-item="">
          <FeatureCard icon={<StickyNote className={ICON} />} title={FEATURES.notes.title} body={FEATURES.notes.body}>
            <ProductImage screen="notes" alt="The current Desknoty calendar with its notes panel open" />
          </FeatureCard>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal data-anim-item="">
            <FeatureCard icon={<Palette className={ICON} />} title={FEATURES.categories.title} body={FEATURES.categories.body}>
              <ProductImage screen="week" alt="Desknoty Full Week view with the calendar sidebar" />
            </FeatureCard>
          </Reveal>
          <Reveal data-anim-item="" delay={80}>
            <FeatureCard icon={<Plus className={ICON} />} title={FEATURES.compact[2].title} body={FEATURES.compact[2].body}>
              <ProductImage screen="event" alt="The current Desknoty new event dialog" />
            </FeatureCard>
          </Reveal>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal data-anim-item="">
            <FeatureCard icon={<LayoutGrid className={ICON} />} title={FEATURES.compact[0].title} body={FEATURES.compact[0].body}>
              <ProductImage screen="month" alt="The current Desknoty Month view" />
            </FeatureCard>
          </Reveal>
          <Reveal data-anim-item="" delay={80}>
            <FeatureCard icon={<Compass className={ICON} />} title={FEATURES.compact[1].title} body={FEATURES.compact[1].body}>
              <ProductImage screen="day" alt="Desknoty Day view with date navigation and view controls" />
            </FeatureCard>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
