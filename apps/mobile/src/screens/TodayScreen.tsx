// "Today" — the proactive Next Best Action queue (Phase 0, Component C).
//
// Reads GET /api/today (ranked today/later/waiting), lets the student act with
// one tap (open the existing compose modal), and dismiss/snooze actions or set
// a meeting date — all via web API routes (mobile never writes Supabase
// directly). No sending happens here.
//
// NOTE (flagged for review): the existing GenerateMessageModal only produces an
// INTRO-style draft and takes no message-type, so RESPOND/SEND_FOLLOWUP/
// SEND_THANKYOU currently open that same composer; type-specific drafts are a
// follow-up. The meeting-date control is a minimal quick-pick (no datetime
// picker dep installed) — reasonable v1, flagged for a real picker later.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/scoutTheme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WEB_API_BASE_URL } from '../lib/api';
import AlumniAvatar from '../components/common/AlumniAvatar';
import GenerateMessageModal from '../components/modals/GenerateMessageModal';
import type { Alumni } from '../types/database';

type ActionType =
  | 'DRAFT_INTRO' | 'SEND_FOLLOWUP' | 'RESPOND' | 'PREP_MEETING' | 'SEND_THANKYOU' | 'AWAIT';

interface TodayAction {
  alumniId: string;
  type: ActionType;
  reason: string;
  compose: 'introduction' | 'follow_up' | 'thank_you' | null;
  daysWaiting?: number;
  networkId: string | null;
  alumnus: Alumni | null;
}
interface Queue { today: TodayAction[]; later: TodayAction[]; waiting: TodayAction[] }

const META: Record<ActionType, { label: string; color: string }> = {
  DRAFT_INTRO:   { label: 'Reach out',  color: colors.textPrimary },
  SEND_FOLLOWUP: { label: 'Follow up',  color: colors.warning },
  RESPOND:       { label: 'Respond',    color: colors.success },
  PREP_MEETING:  { label: 'Prep',       color: colors.textPrimary },
  SEND_THANKYOU: { label: 'Thank you',  color: colors.success },
  AWAIT:         { label: 'Waiting',    color: colors.textTertiary },
};

const MEETING_PICKS: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [queue, setQueue] = useState<Queue>({ today: [], later: [], waiting: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageAlumni, setMessageAlumni] = useState<Alumni | null>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(`${WEB_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, ...(init?.headers ?? {}) },
    });
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await authedFetch('/api/today');
      if (!res.ok) throw new Error(String(res.status));
      setQueue((await res.json()) as Queue);
    } catch {
      setError('Could not load your day. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function override(a: TodayAction, state: 'dismissed' | 'snoozed') {
    setQueue((q) => removeAction(q, a)); // optimistic
    await authedFetch('/api/today/override', {
      method: 'POST',
      body: JSON.stringify({ alumniId: a.alumniId, actionType: a.type, state }),
    }).catch(() => {});
  }

  async function setMeeting(a: TodayAction, days: number) {
    if (!a.networkId) return;
    const meeting_at = new Date(Date.now() + days * 86_400_000).toISOString();
    await authedFetch(`/api/network/${a.networkId}`, { method: 'PATCH', body: JSON.stringify({ meeting_at }) }).catch(() => {});
    load();
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.greeting}>Today</Text>
      <Text style={styles.sub}>Here's what to do next, {firstName}.</Text>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {loading && queue.today.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.textTertiary} />
        ) : error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : queue.today.length === 0 && queue.later.length === 0 && queue.waiting.length === 0 ? (
          <Text style={styles.muted}>Nothing queued yet. Save some alumni and we'll line up your next steps.</Text>
        ) : (
          <>
            <Section title="Do next" items={queue.today} onCompose={setMessageAlumni} onOverride={override} onSetMeeting={setMeeting} />
            {queue.later.length > 0 && (
              <Section title="Later" items={queue.later} onCompose={setMessageAlumni} onOverride={override} onSetMeeting={setMeeting} />
            )}
            {queue.waiting.length > 0 && (
              <Section title="Waiting on a reply" items={queue.waiting} muted />
            )}
          </>
        )}
      </ScrollView>

      <GenerateMessageModal
        alumni={messageAlumni}
        senderName={profile?.full_name ?? 'An Athlete'}
        senderSport={profile?.sport}
        senderYear={profile?.graduation_year}
        visible={messageAlumni != null}
        onClose={() => setMessageAlumni(null)}
      />
    </View>
  );
}

function Section({
  title, items, muted, onCompose, onOverride, onSetMeeting,
}: {
  title: string;
  items: TodayAction[];
  muted?: boolean;
  onCompose?: (a: Alumni) => void;
  onOverride?: (a: TodayAction, state: 'dismissed' | 'snoozed') => void;
  onSetMeeting?: (a: TodayAction, days: number) => void;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((a) => (
        <ActionCard
          key={`${a.alumniId}-${a.type}`}
          action={a}
          muted={muted}
          onCompose={onCompose}
          onOverride={onOverride}
          onSetMeeting={onSetMeeting}
        />
      ))}
    </View>
  );
}

function ActionCard({
  action, muted, onCompose, onOverride, onSetMeeting,
}: {
  action: TodayAction;
  muted?: boolean;
  onCompose?: (a: Alumni) => void;
  onOverride?: (a: TodayAction, state: 'dismissed' | 'snoozed') => void;
  onSetMeeting?: (a: TodayAction, days: number) => void;
}) {
  const meta = META[action.type];
  const alum = action.alumnus;
  return (
    <View style={[styles.card, muted && { opacity: 0.6 }]}>
      <View style={styles.cardRow}>
        {alum && <AlumniAvatar alumni={alum} size={40} />}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.name} numberOfLines={1}>{alum?.full_name ?? 'Alumni'}</Text>
          <Text style={styles.role} numberOfLines={1}>
            {[alum?.role, alum?.company].filter(Boolean).join(' @ ') || alum?.industry || '—'}
          </Text>
        </View>
        <Text style={[styles.chip, { color: meta.color }]}>{meta.label}</Text>
      </View>

      <Text style={styles.reason}>{action.reason}</Text>

      {!muted && (
        <View style={styles.actions}>
          {action.compose && alum && (
            <Pressable style={styles.primaryBtn} onPress={() => onCompose?.(alum)}>
              <Text style={styles.primaryBtnText}>Draft message</Text>
            </Pressable>
          )}
          {action.type === 'PREP_MEETING' && onSetMeeting && (
            <View style={styles.meetingRow}>
              <Text style={styles.meetingLabel}>Set meeting:</Text>
              {MEETING_PICKS.map((p) => (
                <Pressable key={p.days} style={styles.ghostBtn} onPress={() => onSetMeeting(action, p.days)}>
                  <Text style={styles.ghostBtnText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable style={styles.ghostBtn} onPress={() => onOverride?.(action, 'snoozed')}>
            <Text style={styles.ghostBtnText}>Snooze</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={() => onOverride?.(action, 'dismissed')}>
            <Text style={styles.ghostBtnText}>Dismiss</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function removeAction(q: Queue, a: TodayAction): Queue {
  const drop = (xs: TodayAction[]) => xs.filter((x) => !(x.alumniId === a.alumniId && x.type === a.type));
  return { today: drop(q.today), later: drop(q.later), waiting: drop(q.waiting) };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  greeting: { fontSize: 30, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 16 },
  sub: { fontSize: 15, color: colors.textTertiary, paddingHorizontal: 16, marginTop: 2 },
  muted: { fontSize: 14, color: colors.textTertiary, marginTop: 32, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.borderHairline, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  role: { fontSize: 13, color: colors.textTertiary, marginTop: 1 },
  chip: { fontSize: 12, fontWeight: '700' },
  reason: { fontSize: 13, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryBtnText: { color: colors.textInverse, fontSize: 13, fontWeight: '600' },
  ghostBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  ghostBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  meetingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  meetingLabel: { fontSize: 13, color: colors.textTertiary },
});
