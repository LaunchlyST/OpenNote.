import { useEffect } from 'react'

/**
 * Document metadata for the public landing page.
 *
 * `index.html` carries the same tags statically so crawlers and link previews
 * that never execute JavaScript still see them; these helpers keep the live
 * document in step when the route changes.
 */

export const SITE = {
  name: 'Desknoty',
  title: 'Desknoty — Your calendar, with room to think.',
  description:
    'Plan your days, organise your notes, and keep everything that matters in one simple calendar. Free forever, with day, week and month views.',
  appTitle: 'Desknoty — Calendar & Planner',
  locale: 'en_GB',
} as const

type MetaName = 'description' | 'theme-color'

/** Creates (or updates) a `<meta name="...">` tag. */
function setMeta(name: MetaName, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title
    setMeta('description', description)
    // The calendar is a separate route; give it its own title again when the
    // landing page unmounts.
    return () => {
      document.title = SITE.appTitle
      setMeta('description', SITE.description)
    }
  }, [title, description])
}