import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme/scoutTheme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { WEB_API_BASE_URL, autostartCampaign } from '../lib/api';
import AlumniAvatar from '../components/common/AlumniAvatar';
import type { Alumni } from '../types/database';

// ─── Types matching what GET /api/campaign returns ───────────────────────────

interface ReadyItem {
  queueId: string;
  channel: 'email' | 'linkedin';
  messageType: 'introduction' | 'follow_up' | 'thank_you';
  draftBody: string;
  why: string | null;
  alumnus: Alumni;
}

interface ProposedItem {
  networkId: string;
  alumnus: Alumni;
  why: string | null;
}

interface WaitingItem {
  alumniId: string;
  reason: string;
  daysWaiting?: number;
  alumnus: Alumni | null;
}

interface Campaign {
  goalMetric: string;
  goalCount: number;
  deadline: string;
  status: string;
  booked: number;
  meetingsSet: number;
  weeksLeft: number;
}

interface WarmPath { count: number; topName: string; topRelation: 'teammate' | 'same_era' }

interface CampaignPayload {
  campaign: Campaign | null;
  ready: ReadyItem[];
  proposed: ProposedItem[];
  waiting: WaitingItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GOAL_LABEL: Record<string, string> = {
  informational_interview: 'info interviews',
  referral: 'referrals',
  mentor_relationship: 'mentor relationships',
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function subtitle(alum: Alumni): string {
  return [alum.role, alum.company].filter(Boolean).join(' @ ') || alum.industry || '—';
}

function weeksFromNow(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / (7 * 86_400_000)));
}

function formatDeadline(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CampaignScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { profile } = useAuth();

  const [data, setData] = useState<CampaignPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  // Send-draft modal state
  const [sendDraft, setSendDraft] = useState<ReadyItem | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'linkedin' | 'email'>('linkedin');
  const [sending, setSending] = useState(false);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(`${WEB_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, ...(init?.headers ?? {}) },
    });
  }, []);

  const autostartTried = useRef(false);
  const [warm, setWarm] = useState<Record<string, WarmPath>>({});

  // Warm paths for the approval shelf — best-effort, shelf renders without it.
  const loadWarm = useCallback(async (payload: CampaignPayload) => {
    const ids = payload.proposed.map((p) => p.alumnus.id);
    if (!ids.length) return;
    try {
      const res = await authedFetch('/api/alumni/warm-paths', {
        method: 'POST',
        body: JSON.stringify({ alumniIds: ids }),
      });
      if (res.ok) setWarm((await res.json()).paths ?? {});
    } catch {
      // fail silently
    }
  }, [authedFetch]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await authedFetch('/api/campaign');
      if (!res.ok) throw new Error(String(res.status));
      let payload = (await res.json()) as CampaignPayload;

      // No campaign yet → start one from onboarding preferences before ever
      // showing the manual goal form. Tried once per mount; a skip (thin
      // profile) falls through to the set-up CTA.
      if (!payload.campaign && !autostartTried.current) {
        autostartTried.current = true;
        if (await autostartCampaign()) {
          const retry = await authedFetch('/api/campaign');
          if (retry.ok) payload = (await retry.json()) as CampaignPayload;
        }
      }

      setData(payload);
      loadWarm(payload);
    } catch {
      setError('Could not load your campaign. Pull to refresh.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, loadWarm]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  // ── Actions ──────────────────────────────────────────────────────────────

  async function postApprove(body: Record<string, string>): Promise<boolean> {
    try {
      const res = await authedFetch('/api/today/approve', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleSend(sentVia: 'linkedin' | 'email' | 'copied' | 'marked') {
    if (!sendDraft) return;
    setSending(true);
    const ok = await postApprove({
      action: 'send',
      queueId: sendDraft.queueId,
      editedBody,
      sentVia,
    });
    if (ok) {
      setData((d) => (d ? { ...d, ready: d.ready.filter((r) => r.queueId !== sendDraft.queueId) } : d));
      setSendDraft(null);
    } else {
      Alert.alert('Failed to send', 'Could not record the send. Please try again.');
    }
    setSending(false);
  }

  async function handleDismissDraft(queueId: string) {
    setBusy(queueId);
    const ok = await postApprove({ action: 'dismiss_draft', queueId });
    if (ok) {
      setData((d) => (d ? { ...d, ready: d.ready.filter((r) => r.queueId !== queueId) } : d));
    }
    setBusy(null);
  }

  async function handleApproveTarget(networkId: string) {
    setBusy(networkId);
    const ok = await postApprove({ action: 'approve_target', networkId });
    if (ok) {
      setData((d) => (d ? { ...d, proposed: d.proposed.filter((p) => p.networkId !== networkId) } : d));
    }
    setBusy(null);
  }

  async function handleDismissTarget(networkId: string) {
    setBusy(networkId);
    const ok = await postApprove({ action: 'dismiss_target', networkId });
    if (ok) {
      setData((d) => (d ? { ...d, proposed: d.proposed.filter((p) => p.networkId !== networkId) } : d));
    }
    setBusy(null);
  }

  function openSendDraft(item: ReadyItem) {
    setSendDraft(item);
    setEditedBody(item.draftBody);
    setSelectedChannel(item.channel);
  }

  // ── Computing display values ──────────────────────────────────────────────

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  if (loading && !data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSection}>
          <Text style={styles.heading}>Campaign</Text>
        </View>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.textTertiary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSection}>
          <Text style={styles.heading}>Campaign</Text>
        </View>
        <Text style={styles.muted}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const noCampaign = !data?.campaign;

  if (noCampaign) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <Text style={styles.heading}>Campaign</Text>
          <Text style={styles.sub}>Welcome back, {firstName}.</Text>

          <View style={[styles.card, { marginTop: 24, alignItems: 'center', paddingVertical: 32 }]}>
            <Ionicons name="rocket-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No campaign set yet</Text>
            <Text style={styles.emptyDesc}>
              Set a goal — what industry, how many conversations, by when. Scout will find
              the right alumni and draft your outreach.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('GoalSetup')}
            >
              <Ionicons name="flag-outline" size={16} color={colors.textInverse} />
              <Text style={styles.primaryBtnText}>Set up your campaign</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const c = data!.campaign!;
  const pct = c.goalCount > 0 ? Math.min(100, Math.round((c.booked / c.goalCount) * 100)) : 0;
  const readyCount = data!.ready.length;
  const proposedCount = data!.proposed.length;
  const waitingCount = data!.waiting.length;
  const nothingToDo = readyCount === 0 && proposedCount === 0 && waitingCount === 0;

  const narrative =
    readyCount > 0 && proposedCount > 0
      ? `Since you were away, I drafted ${plural(readyCount, 'intro', 'intros')} for you to send and lined up ${plural(proposedCount, 'alum', 'alumni')} to approve.`
      : readyCount > 0
        ? `I have ${plural(readyCount, 'draft', 'drafts')} ready for you to review and send.`
        : proposedCount > 0
          ? `I lined up ${plural(proposedCount, 'alum', 'alumni')} who fit — approve the ones you like and I'll draft the intros.`
          : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <Text style={styles.heading}>Campaign</Text>
        <Text style={styles.sub}>Welcome back, {firstName}.</Text>

        {/* ── Goal + progress ─────────────────────────────────────────────── */}
        <View style={[styles.card, { marginTop: 20 }]}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalMetric}>
              {c.goalCount} {GOAL_LABEL[c.goalMetric] ?? 'connections'}
            </Text>
            <StatusBadge status={c.status} />
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%` as `${number}%` }]} />
          </View>

          <View style={styles.goalMeta}>
            <Text style={styles.goalMetaText}>
              <Text style={styles.goalMetaBold}>{c.booked} of {c.goalCount}</Text> booked
            </Text>
            {c.weeksLeft > 0 && (
              <Text style={styles.goalMetaText}>
                {plural(c.weeksLeft, 'week', 'weeks')} left
              </Text>
            )}
            {c.meetingsSet > 0 && (
              <Text style={styles.goalMetaText}>
                {c.meetingsSet} scheduled
              </Text>
            )}
          </View>

          {c.deadline && (
            <Text style={styles.deadlineText}>
              Deadline: {formatDeadline(c.deadline)}
            </Text>
          )}
        </View>

        {/* ── Narrative ──────────────────────────────────────────────────── */}
        {narrative && (
          <Text style={styles.narrative}>{narrative}</Text>
        )}

        {/* ── Ready to send ──────────────────────────────────────────────── */}
        {readyCount > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ready for you to send</Text>
            {data!.ready.map((item) => (
              <View key={item.queueId} style={[styles.card, { marginBottom: 10 }]}>
                <Pressable style={styles.alumniRow}>
                  <AlumniAvatar alumni={item.alumnus} size={40} />
                  <View style={styles.alumniInfo}>
                    <Text style={styles.name} numberOfLines={1}>{item.alumnus.full_name}</Text>
                    <Text style={styles.role} numberOfLines={1}>{subtitle(item.alumnus)}</Text>
                  </View>
                  <ChannelTag channel={item.channel} />
                </Pressable>

                {/* Draft preview */}
                <Pressable
                  style={styles.draftPreview}
                  onPress={() => setExpandedDraft(expandedDraft === item.queueId ? null : item.queueId)}
                >
                  <Text
                    style={styles.draftBody}
                    numberOfLines={expandedDraft === item.queueId ? undefined : 2}
                  >
                    {item.draftBody}
                  </Text>
                  <Text style={styles.expandToggle}>
                    {expandedDraft === item.queueId ? 'Hide draft' : 'Read full draft'}
                  </Text>
                </Pressable>

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => openSendDraft(item)}
                  >
                    <Text style={styles.primaryBtnText}>Review & send</Text>
                  </Pressable>
                  <Pressable
                    style={styles.ghostBtn}
                    onPress={() => handleDismissDraft(item.queueId)}
                    disabled={busy === item.queueId}
                  >
                    <Text style={styles.ghostBtnText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Who-to-contact approval shelf ──────────────────────────────── */}
        {proposedCount > 0 && (
          <>
            <Text style={styles.sectionTitle}>People Scout found for you</Text>
            {data!.proposed.map((p) => (
              <View key={p.networkId} style={[styles.card, styles.proposedCard, { marginBottom: 10 }]}>
                <View style={styles.alumniRow}>
                  <AlumniAvatar alumni={p.alumnus} size={40} />
                  <View style={styles.alumniInfo}>
                    <Text style={styles.name} numberOfLines={1}>{p.alumnus.full_name}</Text>
                    <Text style={styles.role} numberOfLines={1}>{subtitle(p.alumnus)}</Text>
                    {warm[p.alumnus.id] ? (
                      <Text style={styles.warmText} numberOfLines={2}>
                        {warm[p.alumnus.id].count > 1
                          ? `${warm[p.alumnus.id].topName} +${warm[p.alumnus.id].count - 1} more in your network can introduce you`
                          : `${warm[p.alumnus.id].topName} in your network ${warm[p.alumnus.id].topRelation === 'teammate' ? 'played with them' : 'was on campus with them'}`}
                      </Text>
                    ) : null}
                    {p.why && (
                      <Text style={styles.whyText}>{p.why}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.approveBtn}
                    onPress={() => handleApproveTarget(p.networkId)}
                    disabled={busy === p.networkId}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                    <Text style={styles.approveBtnText}>Approve</Text>
                  </Pressable>
                  <Pressable
                    style={styles.ghostBtn}
                    onPress={() => handleDismissTarget(p.networkId)}
                    disabled={busy === p.networkId}
                  >
                    <Text style={styles.ghostBtnText}>Not interested</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Waiting on replies ─────────────────────────────────────────── */}
        {waitingCount > 0 && (
          <>
            <Text style={styles.sectionTitle}>Waiting on replies</Text>
            {data!.waiting.filter((w) => w.alumnus).map((w) => (
              <View key={w.alumniId} style={[styles.waitingRow, { marginBottom: 8 }]}>
                <AlumniAvatar alumni={w.alumnus!} size={32} />
                <View style={styles.waitingInfo}>
                  <Text style={styles.waitingName} numberOfLines={1}>{w.alumnus!.full_name}</Text>
                  <Text style={styles.waitingReason} numberOfLines={1}>{w.reason}</Text>
                </View>
                {w.daysWaiting != null && (
                  <Text style={styles.waitingDays}>{w.daysWaiting}d</Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* ── Empty state — goal set, nothing queued ─────────────────────── */}
        {nothingToDo && (
          <View style={[styles.card, { marginTop: 20, alignItems: 'center', paddingVertical: 24 }]}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text style={styles.emptyTitle}>Scout is working your campaign.</Text>
            <Text style={styles.emptyDesc}>
              Nothing is queued right now — Scout surfaces only genuine matches, never filler.
              If your focus is narrow, broadening the field or city gives it more to work with.
            </Text>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('GoalSetup')}
            >
              <Text style={styles.secondaryBtnText}>Adjust or broaden goal</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footer}>
          Prepared for you — nothing is sent until you send it, and no one is contacted
          until you approve them.
        </Text>
      </ScrollView>

      {/* ── Send Draft Modal ─────────────────────────────────────────────── */}
      <SendDraftModal
        visible={sendDraft != null}
        item={sendDraft}
        editedBody={editedBody}
        selectedChannel={selectedChannel}
        sending={sending}
        onChangeBody={setEditedBody}
        onChangeChannel={setSelectedChannel}
        onSend={handleSend}
        onClose={() => setSendDraft(null)}
        onCopy={async () => {
          await Clipboard.setStringAsync(editedBody);
          Alert.alert('Copied to clipboard');
        }}
      />
    </View>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    active: { label: 'Active', color: colors.success, bg: colors.successLight },
    completed: { label: 'Completed', color: colors.textSecondary, bg: colors.surfaceMuted },
    paused: { label: 'Paused', color: colors.warning, bg: colors.warningLight },
  };
  const c = config[status] ?? { label: status, color: colors.textTertiary, bg: colors.surfaceMuted };
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg, borderColor: c.color }]}>
      <Text style={[styles.statusBadgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ─── Channel Tag ─────────────────────────────────────────────────────────────

function ChannelTag({ channel }: { channel: 'email' | 'linkedin' }) {
  return (
    <View style={styles.channelTag}>
      <Text style={styles.channelTagText}>{channel}</Text>
    </View>
  );
}

// ─── Send Draft Modal ────────────────────────────────────────────────────────

interface SendDraftModalProps {
  visible: boolean;
  item: ReadyItem | null;
  editedBody: string;
  selectedChannel: 'linkedin' | 'email';
  sending: boolean;
  onChangeBody: (text: string) => void;
  onChangeChannel: (ch: 'linkedin' | 'email') => void;
  onSend: (sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => void;
  onClose: () => void;
  onCopy: () => void;
}

function SendDraftModal({
  visible,
  item,
  editedBody,
  selectedChannel,
  sending,
  onChangeBody,
  onChangeChannel,
  onSend,
  onClose,
  onCopy,
}: SendDraftModalProps) {
  const insets = useSafeAreaInsets();

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHandleRow}>
          <View style={styles.modalHandle} />
        </View>

        <Pressable style={styles.modalCloseBtn} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Review & send</Text>
          <Text style={styles.modalSubtitle}>
            Draft for {item.alumnus.full_name}
          </Text>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Channel picker */}
          <Text style={styles.fieldLabel}>Send via</Text>
          <View style={styles.channelPicker}>
            <Pressable
              style={[styles.channelOption, selectedChannel === 'linkedin' && styles.channelOptionActive]}
              onPress={() => onChangeChannel('linkedin')}
            >
              <Ionicons
                name="logo-linkedin"
                size={16}
                color={selectedChannel === 'linkedin' ? colors.red : colors.textTertiary}
              />
              <Text
                style={[
                  styles.channelOptionText,
                  selectedChannel === 'linkedin' && styles.channelOptionTextActive,
                ]}
              >
                LinkedIn
              </Text>
            </Pressable>
            <Pressable
              style={[styles.channelOption, selectedChannel === 'email' && styles.channelOptionActive]}
              onPress={() => onChangeChannel('email')}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={selectedChannel === 'email' ? colors.red : colors.textTertiary}
              />
              <Text
                style={[
                  styles.channelOptionText,
                  selectedChannel === 'email' && styles.channelOptionTextActive,
                ]}
              >
                Email
              </Text>
            </Pressable>
          </View>

          {/* Message body (editable) */}
          <Text style={styles.fieldLabel}>Message</Text>
          <TextInput
            style={styles.messageInput}
            value={editedBody}
            onChangeText={onChangeBody}
            multiline
            textAlignVertical="top"
            scrollEnabled
          />
        </ScrollView>

        <View style={[styles.modalActions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            style={styles.sendBtn}
            onPress={() => onSend(selectedChannel)}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Ionicons name="paper-plane" size={16} color={colors.textInverse} />
                <Text style={styles.sendBtnText}>Send via {selectedChannel}</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.copyBtn} onPress={onCopy}>
            <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.copyBtnText}>Copy</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 30, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 16 },
  sub: { fontSize: 15, color: colors.textTertiary, paddingHorizontal: 16, marginTop: 2 },
  muted: { fontSize: 14, color: colors.textTertiary, marginTop: 32, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
  headerSection: { paddingHorizontal: 16, marginBottom: 8 },
  retryBtn: { marginTop: 16, alignSelf: 'center', backgroundColor: colors.textPrimary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: colors.textInverse, fontSize: 14, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    padding: 14,
  },
  proposedCard: {
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceMuted,
  },

  // Goal section
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalMetric: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressBarBg: {
    marginTop: 12,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.red,
  },
  goalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  goalMetaText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  goalMetaBold: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deadlineText: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 4,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Narrative
  narrative: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 16,
    paddingHorizontal: 2,
  },

  // Section title
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },

  // Alumni row
  alumniRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alumniInfo: {
    flex: 1,
    marginLeft: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  role: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 1,
  },
  whyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  warmText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.statusMeeting,
    marginTop: 6,
    lineHeight: 18,
  },

  // Channel tag
  channelTag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  channelTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Draft preview
  draftPreview: {
    marginTop: 10,
  },
  draftBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  expandToggle: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 4,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '600',
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.successLight,
  },
  approveBtnText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Waiting
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    padding: 12,
    opacity: 0.7,
  },
  waitingInfo: {
    flex: 1,
    marginLeft: 10,
  },
  waitingName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  waitingReason: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 1,
  },
  waitingDays: {
    fontSize: 12,
    color: colors.textDisabled,
    fontWeight: '500',
    marginLeft: 8,
  },

  // Empty state
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },

  // Footer
  footer: {
    fontSize: 12,
    color: colors.textDisabled,
    lineHeight: 17,
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ── Send draft modal ────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.title2,
    fontSize: 24,
    marginBottom: 2,
  },
  modalSubtitle: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: spacing.xl,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  channelPicker: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  channelOptionActive: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  channelOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  channelOptionTextActive: {
    color: colors.red,
    fontWeight: '600',
  },
  messageInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sendBtn: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  sendBtnText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '600',
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  copyBtnText: {
    ...typography.headline,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
