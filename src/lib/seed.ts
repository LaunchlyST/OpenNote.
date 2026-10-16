import type { Settings } from './types'

/**
 * Default per-project settings. OpenNote no longer generates any sample
 * events, notes or tasks: every project starts empty.
 */
export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
  hour12: false,
  showWeekends: true,
  hourHeight: 56,
  defaultView: 'week',
  reduceMotion: false,
  sidebarCollapsed: false,
  twoFactor: false,
}
