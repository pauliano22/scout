import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Jobs board temporarily hidden — not ready for students or alumni yet.
// The full page lives in git history (and JobsClient.tsx + /api/jobs remain);
// to re-enable, restore this file (git revert this commit) and put the two
// /jobs nav links back in Navbar.tsx.
export default async function JobsPage() {
  redirect('/discover')
}
