import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { postLoginPath } from '@/lib/auth/postLoginPath'
import type { UserRole } from '@scout/shared/types/database'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_role, onboarding_completed')
    .eq('id', user.id)
    .single()

  redirect(
    postLoginPath(
      (profile?.account_role as UserRole | undefined) ?? 'student',
      Boolean(profile?.onboarding_completed),
    ),
  )
}
