import { createContext, useContext } from 'react'
import type { ProjectSummary } from './api'

/** The project whose calendar is open, for the calendar chrome (Back to Projects, name). */
export const ProjectContext = createContext<ProjectSummary | null>(null)

export function useCurrentProject(): ProjectSummary | null {
  return useContext(ProjectContext)
}
