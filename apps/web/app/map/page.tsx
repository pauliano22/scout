import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import CirclesClient from './CirclesClient'

export const metadata = {
  title: 'Circles · Scout',
  description: 'Who they played with, season by season, and the warm paths through your own network.',
}

export default async function CirclesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: network } = await supabase
    .from('user_networks')
    .select('alumni_id, status')
    .eq('user_id', user.id)

  // Agent-proposed targets aren't the student's network yet; dismissed ones never were.
  const saved = (network ?? [])
    .filter(n => !['proposed', 'not_interested'].includes((n.status as string) ?? ''))
    .map(n => ({
      alumniId: n.alumni_id as string,
      status: (n.status as string) ?? null,
    }))

  return (
    <div className="flex flex-col h-dvh">
      <Navbar user={{ email: user.email ?? '' }} networkCount={saved.length} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CirclesClient userId={user.id} saved={saved} />
      </div>
    </div>
  )
}
