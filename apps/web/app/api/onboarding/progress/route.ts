import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { OnboardingProgress, OnboardingStep } from '@scout/shared/types/database'
import { ONBOARDING_STEPS } from '@scout/shared/types/database'

/**
 * GET /api/onboarding/progress
 *
 * Returns the current onboarding progress for the authenticated user.
 * Auto-detects completion by checking the user's profile, network, and messages.
 *
 * Response: OnboardingProgress
 */
export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 1. Fetch profile ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, full_name, sport, graduation_year')
      .eq('id', user.id)
      .single()

    // ── 2. Fetch network count ────────────────────────────────────────
    const { count: networkCount } = await supabase
      .from('user_networks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // ── 3. Fetch message count ────────────────────────────────────────
    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // ── 4. Compute milestones ─────────────────────────────────────────
    const hasPhoto = Boolean(profile?.avatar_url)
    const hasBio = Boolean(profile?.full_name && profile?.sport && profile?.graduation_year)
    const hasFirstConnection = (networkCount ?? 0) > 0
    const hasFirstMessage = (messageCount ?? 0) > 0

    const completedSteps: OnboardingStep[] = []
    if (hasPhoto) completedSteps.push('add_photo')
    if (hasBio) completedSteps.push('complete_bio')
    if (hasFirstConnection) completedSteps.push('first_connection')
    if (hasFirstMessage) completedSteps.push('first_message')

    // ── 5. Upsert to DB for caching ──────────────────────────────────
    const progress: OnboardingProgress = {
      user_id: user.id,
      has_photo: hasPhoto,
      has_bio: hasBio,
      has_first_connection: hasFirstConnection,
      has_first_message: hasFirstMessage,
      completed_steps: completedSteps,
      updated_at: new Date().toISOString(),
    }

    await supabase
      .from('onboarding_progress')
      .upsert(progress, { onConflict: 'user_id' })

    // Also determine the "current" step (the first incomplete one)
    let currentStepIndex = completedSteps.length
    // Clamp to valid range
    if (currentStepIndex >= ONBOARDING_STEPS.length) {
      currentStepIndex = ONBOARDING_STEPS.length // all done
    }

    return NextResponse.json({
      ...progress,
      currentStepIndex,
      totalSteps: ONBOARDING_STEPS.length,
      isComplete: completedSteps.length >= ONBOARDING_STEPS.length,
    })
  } catch (err) {
    console.error('[onboarding/progress] error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding progress' },
      { status: 500 },
    )
  }
}
