import { redirect } from 'next/navigation'

// Retired surface. The agentic picks page (/campaign) is the single student
// home; it routes non-students to their own home. PlanClient/SearchClient are
// kept in the tree (reversible) but are no longer a landing destination.
export default function PlanPage() {
  redirect('/campaign')
}
