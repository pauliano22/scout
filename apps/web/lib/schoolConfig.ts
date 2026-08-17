'use client'

import { useEffect, useState } from 'react'
import { Waypoints, BookMarked, type LucideIcon } from 'lucide-react'

/**
 * Per-school copy and iconography, keyed off the same `data-school` attribute
 * the CSS theming uses so a school is declared in one place.
 *
 * This exists because the alternative was threading a prop per string through
 * Navbar, CirclesClient, TeamBoard, LockerRoom and ProfileClient. Anything a
 * school renames belongs here, not in another optional prop.
 */
export interface SchoolConfig {
  /** Inline in copy: "Cornell Ice Hockey", "Search any Cornell athlete". */
  name: string
  /** The teammate-graph surface. Cornell calls it Team; a prep school's
   *  version is class-based, so Hill calls it the Yearbook. */
  circlesLabel: string
  circlesIcon: LucideIcon
  circlesTagline: string
}

const CORNELL: SchoolConfig = {
  name: 'Cornell',
  circlesLabel: 'Team',
  circlesIcon: Waypoints,
  circlesTagline: 'Who played with whom, season by season.',
}

const SCHOOLS: Record<string, SchoolConfig> = {
  cornell: CORNELL,
  hill: {
    name: 'The Hill School',
    circlesLabel: 'Yearbook',
    circlesIcon: BookMarked,
    circlesTagline: 'Who was here with you, class by class.',
  },
  harvard:   { ...CORNELL, name: 'Harvard' },
  yale:      { ...CORNELL, name: 'Yale' },
  princeton: { ...CORNELL, name: 'Princeton' },
  penn:      { ...CORNELL, name: 'Penn' },
  columbia:  { ...CORNELL, name: 'Columbia' },
  brown:     { ...CORNELL, name: 'Brown' },
  dartmouth: { ...CORNELL, name: 'Dartmouth' },
}

/**
 * Starts at Cornell so server and first client render agree; a themed instance
 * corrects it on mount.
 */
export function useSchoolConfig(): SchoolConfig {
  const [config, setConfig] = useState<SchoolConfig>(CORNELL)

  useEffect(() => {
    const key = document.documentElement.getAttribute('data-school')
    if (key && SCHOOLS[key]) setConfig(SCHOOLS[key])
  }, [])

  return config
}

/** Convenience for the many call sites that only need the display name. */
export function useSchoolName(): string {
  return useSchoolConfig().name
}
