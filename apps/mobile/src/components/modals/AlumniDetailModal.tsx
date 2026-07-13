import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme/scoutTheme';
import { supabase } from '../../lib/supabase';
import { WEB_API_BASE_URL } from '../../lib/api';
import {
  formatExperienceDates,
  formatGradYearShort,
  formatSportLabel,
  type NormalizedAlumni,
} from '../../lib/alumniProfile';
import type { ScoredAlumni } from '../../services/recommendations';
import AlumniAvatar from '../common/AlumniAvatar';
import CornellCircleSection from '../CornellCircleSection';

const HERO_HEIGHT = 260;

const STATUS_STEPS: { value: string; label: string; color: string; bg: string }[] = [
  { value: 'saved',           label: 'Saved',       color: colors.statusSaved,     bg: colors.statusSavedBg },
  { value: 'message_drafted', label: 'Drafted',     color: colors.statusDrafted,   bg: colors.statusDraftedBg },
  { value: 'contacted',       label: 'Contacted',   color: colors.statusContacted, bg: colors.statusContactedBg },
  { value: 'replied',         label: 'Replied',     color: colors.statusReplied,   bg: colors.statusRepliedBg },
  { value: 'meeting_set',     label: 'Meeting Set', color: colors.statusMeeting,   bg: colors.statusMeetingBg },
];

interface Props {
  alumni: ScoredAlumni | null;
  visible: boolean;
  onClose: () => void;
  onSave: (alumni: ScoredAlumni) => void;
  onPass: (alumni: ScoredAlumni) => void;
  onGenerateMessage?: (alumni: ScoredAlumni) => void;
  networkEntryId?: string;
  networkStatus?: string;
  networkNotes?: string | null;
}

export default function AlumniDetailModal({
  alumni,
  visible,
  onClose,
  onSave,
  onPass,
  onGenerateMessage,
  networkEntryId,
  networkStatus,
  networkNotes,
}: Props) {
  const insets = useSafeAreaInsets();
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const [localStatus, setLocalStatus] = useState(networkStatus ?? 'saved');
  const [notesDraft, setNotesDraft] = useState(networkNotes ?? '');
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync incoming props when modal reopens for a different entry.
  useEffect(() => {
    setLocalStatus(networkStatus ?? 'saved');
    setNotesDraft(networkNotes ?? '');
  }, [networkEntryId, networkStatus, networkNotes]);

  async function patchNetwork(updates: Record<string, unknown>) {
    if (!networkEntryId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch(`${WEB_API_BASE_URL}/api/network/${networkEntryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
    } catch {
      // Fail silently — status is already updated optimistically in UI.
    }
  }

  function handleStatusTap(value: string) {
    setLocalStatus(value);
    patchNetwork({ status: value });
  }

  function handleNotesBlur() {
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    patchNetwork({ notes: notesDraft || null });
  }

  if (!alumni) return null;

  const profile = alumni.profile;
  const showPhoto = !!profile.photoUrl && !imageError;

  const flashCopy = (label: string) => {
    setCopyHint(label);
    setTimeout(() => setCopyHint(null), 1600);
  };

  const handleOpenLinkedIn = () => {
    if (!profile.linkedinUrl) return;
    Linking.openURL(profile.linkedinUrl).catch(() => Alert.alert('Could not open LinkedIn'));
  };

  const handleCopyLinkedIn = async () => {
    if (!profile.linkedinUrl) return;
    await Clipboard.setStringAsync(profile.linkedinUrl);
    flashCopy('LinkedIn copied');
  };

  const handleOpenEmail = () => {
    if (!profile.email) return;
    Linking.openURL(`mailto:${profile.email}`).catch(() => Alert.alert('Could not open email'));
  };

  const handleCopyEmail = async () => {
    if (!profile.email) return;
    await Clipboard.setStringAsync(profile.email);
    flashCopy('Email copied');
  };

  const yearShort = formatGradYearShort(profile.graduationYear);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Close button floats above everything */}
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={20} color={showPhoto ? '#fff' : colors.textSecondary} />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces
          contentContainerStyle={styles.scrollContent}
        >
          {/* Drag handle */}
          <View style={[styles.handleRow, showPhoto && styles.handleRowOnPhoto]}>
            <View style={[styles.handle, showPhoto && styles.handleOnPhoto]} />
          </View>

          {/* Hero */}
          {showPhoto ? (
            <View style={styles.hero}>
              <Image
                source={{ uri: profile.photoUrl! }}
                style={styles.heroPhoto}
                onError={() => setImageError(true)}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.70)']}
                style={styles.heroGradient}
                pointerEvents="none"
              />
              <View style={styles.heroOverlay}>
                <Text style={styles.heroName} numberOfLines={1}>{profile.name}</Text>
                {(profile.currentRole || profile.currentCompany) ? (
                  <Text style={styles.heroRole} numberOfLines={1}>
                    {profile.currentRole && profile.currentCompany
                      ? `${profile.currentRole}  ·  ${profile.currentCompany}`
                      : profile.currentRole ?? profile.currentCompany}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.fallbackHeader}>
              <AlumniAvatar alumni={profile} size={80} />
              <Text style={styles.fallbackName}>{profile.name}</Text>
              {(profile.currentRole || profile.currentCompany) ? (
                <Text style={styles.fallbackRole}>
                  {profile.currentRole && profile.currentCompany
                    ? `${profile.currentRole}  ·  ${profile.currentCompany}`
                    : profile.currentRole ?? profile.currentCompany}
                </Text>
              ) : null}
              {yearShort || profile.sport ? (
                <Text style={styles.fallbackMeta}>
                  {[profile.sport, yearShort ? `Class of ${yearShort}` : null].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          )}

          {/* Profile summary */}
          <View style={styles.profileSummary}>
            <View style={styles.profileSummaryName}>
              <Text style={styles.summaryName}>{profile.name}</Text>
              {yearShort ? (
                <Text style={styles.summaryGradYear}>Class of {yearShort}</Text>
              ) : null}
            </View>
            {(profile.currentRole || profile.currentCompany) ? (
              <Text style={styles.summaryRole} numberOfLines={2}>
                {profile.currentRole && profile.currentCompany
                  ? `${profile.currentRole} · ${profile.currentCompany}`
                  : profile.currentRole ?? profile.currentCompany}
              </Text>
            ) : null}
            <View style={styles.summaryPills}>
              {profile.sport ? (
                <View style={styles.pill}>
                  <Ionicons name="football-outline" size={12} color={colors.red} />
                  <Text style={styles.pillText}>{formatSportLabel(profile.sport)}</Text>
                </View>
              ) : null}
              {profile.location ? (
                <View style={styles.pill}>
                  <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.pillText}>{profile.location}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Tracking — Network context only */}
          {networkEntryId ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tracking</Text>

              {/* Status chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={styles.statusChipsRow}
              >
                {STATUS_STEPS.map((step) => {
                  const active = localStatus === step.value;
                  return (
                    <Pressable
                      key={step.value}
                      style={[
                        styles.statusChip,
                        active
                          ? { backgroundColor: step.bg, borderColor: step.color }
                          : { backgroundColor: colors.surface, borderColor: colors.borderLight },
                      ]}
                      onPress={() => handleStatusTap(step.value)}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: active ? step.color : colors.textTertiary },
                        ]}
                      >
                        {step.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Notes */}
              <TextInput
                style={styles.notesInput}
                value={notesDraft}
                onChangeText={setNotesDraft}
                onBlur={handleNotesBlur}
                placeholder="Add a note…"
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {/* Experience */}
          {profile.pastExperiences.length > 0 ? (
            <Section label="Experience">
              <View style={styles.timeline}>
                {profile.pastExperiences.slice(0, 6).map((entry, i) => {
                  const dates = formatExperienceDates(entry);
                  const isLast = i === Math.min(profile.pastExperiences.length, 6) - 1;
                  return (
                    <View key={i} style={styles.timelineRow}>
                      <View style={styles.timelineColumn}>
                        <View style={styles.timelineDot} />
                        {!isLast ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={styles.timelineContent}>
                        {entry.title ? <Text style={styles.expTitle}>{entry.title}</Text> : null}
                        {entry.company ? <Text style={styles.expCompany}>{entry.company}</Text> : null}
                        {dates ? <Text style={styles.expDates}>{dates}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {/* Athletic Background */}
          {(profile.sport || profile.graduationYear || profile.education.length > 0) ? (
            <Section label="Athletic Background">
              <View style={{ gap: 6 }}>
                {profile.sport ? (
                  <Text style={styles.bodyText}>
                    {formatSportLabel(profile.sport)}
                    {profile.graduationYear ? `  ·  Class of ${profile.graduationYear}` : ''}
                  </Text>
                ) : profile.graduationYear ? (
                  <Text style={styles.bodyText}>Class of {profile.graduationYear}</Text>
                ) : null}
                {profile.education
                  .filter((e) => e.school && !e.school.toLowerCase().includes('cornell'))
                  .slice(0, 2)
                  .map((edu, i) => (
                    <Text key={i} style={styles.bodyTextMuted}>
                      {edu.school}
                      {edu.degree ? `  ·  ${edu.degree}` : ''}
                      {edu.field ? `, ${edu.field}` : ''}
                    </Text>
                  ))}
              </View>
            </Section>
          ) : null}

          {/* Cornell Circle — teammates + warm paths through the student's network */}
          <CornellCircleSection alumniId={alumni?.id ?? null} visible={visible} />

          {/* Contact */}
          {(profile.linkedinUrl || profile.email) ? (
            <Section label="Contact">
              <View style={styles.contactGroup}>
                {profile.linkedinUrl ? (
                  <ContactRow
                    icon="logo-linkedin"
                    primary="LinkedIn"
                    secondary={prettyUrl(profile.linkedinUrl)}
                    onPress={handleOpenLinkedIn}
                    onCopy={handleCopyLinkedIn}
                  />
                ) : null}
                {profile.email ? (
                  <ContactRow
                    icon="mail-outline"
                    primary="Email"
                    secondary={profile.email}
                    onPress={handleOpenEmail}
                    onCopy={handleCopyEmail}
                  />
                ) : null}
              </View>
              {copyHint ? <Text style={styles.copyHint}>{copyHint}</Text> : null}
            </Section>
          ) : (
            <Section label="Contact">
              <Text style={styles.bodyTextMuted}>
                Contact available when this alum joins Scout. You can still save
                them and draft a message.
              </Text>
            </Section>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action bar */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            style={styles.passAction}
            onPress={() => { onPass(alumni); onClose(); }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
            <Text style={styles.passActionText}>Pass</Text>
          </Pressable>

          {onGenerateMessage ? (
            <Pressable
              style={styles.messageAction}
              onPress={() => onGenerateMessage(alumni)}
            >
              <Ionicons name="mail-outline" size={18} color={colors.textInverse} />
              <Text style={styles.saveActionText}>Message</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.saveAction}
              onPress={() => { onSave(alumni); onClose(); }}
            >
              <Ionicons name="bookmark" size={18} color={colors.textInverse} />
              <Text style={styles.saveActionText}>Save</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

interface ContactRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  primary: string;
  secondary: string;
  onPress: () => void;
  onCopy: () => void;
}

function ContactRow({ icon, primary, secondary, onPress, onCopy }: ContactRowProps) {
  return (
    <View style={styles.contactRow}>
      <Pressable style={styles.contactBody} onPress={onPress}>
        <View style={styles.contactIcon}>
          <Ionicons name={icon} size={18} color={colors.textPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contactPrimary}>{primary}</Text>
          <Text style={styles.contactSecondary} numberOfLines={1}>{secondary}</Text>
        </View>
      </Pressable>
      <Pressable style={styles.copyButton} onPress={onCopy} hitSlop={8}>
        <Ionicons name="copy-outline" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // Handle
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
    zIndex: 10,
  },
  handleRowOnPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  handleOnPhoto: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Hero photo
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.55,
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    gap: 4,
  },
  heroName: {
    ...typography.title2,
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
  },
  heroRole: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Fallback header (no photo)
  fallbackHeader: {
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  fallbackName: {
    ...typography.title2,
    fontSize: 24,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fallbackRole: {
    ...typography.callout,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fallbackMeta: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
    marginTop: 2,
  },

  // Profile summary
  profileSummary: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: 6,
  },
  profileSummaryName: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  summaryName: {
    ...typography.title2,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryGradYear: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
  },
  summaryRole: {
    ...typography.callout,
    color: colors.textSecondary,
  },
  summaryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillText: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Sections wrapper
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: 0,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },

  // Body text
  bodyText: {
    ...typography.callout,
    color: colors.textPrimary,
    lineHeight: 23,
  },
  bodyTextMuted: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 21,
  },

  // Experience timeline
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  timelineColumn: {
    width: 12,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.red,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 2,
    gap: 2,
  },
  expTitle: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  expCompany: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  expDates: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginTop: 1,
  },

  // Contact
  contactGroup: {
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPrimary: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  contactSecondary: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginTop: 1,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyHint: {
    ...typography.caption1,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // Tracking section
  statusChipsRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusChipText: {
    ...typography.footnote,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.callout,
    color: colors.textPrimary,
    minHeight: 72,
  },

  // Action bar
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  passAction: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  passActionText: {
    ...typography.subhead,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveAction: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.red,
  },
  messageAction: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.textPrimary,
  },
  saveActionText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '700',
  },
});
