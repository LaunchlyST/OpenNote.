import { useRouter } from '../router'
import { DesignIndex } from './DesignIndex'
import { DesignA } from './DesignA'
import { DesignB } from './DesignB'
import { DesignC } from './DesignC'

/**
 * Isolated entry point for the Coming Soon design exploration.
 *
 * Mounted at `/design/*` only — the production `/` page and `/landing` are not
 * affected. `/design` is the comparison workspace; `/design/a|b|c` render one
 * concept full-screen.
 */
export default function DesignPreview() {
  const { path } = useRouter()
  if (path === '/design/a') return <DesignA />
  if (path === '/design/b') return <DesignB />
  if (path === '/design/c') return <DesignC />
  return <DesignIndex />
}
