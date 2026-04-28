import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme/scoutTheme';
import {
  formatExperienceDates,
  formatGradYearShort,
  type NormalizedAlumni,
} from '../../lib/alumniProfile';
import type { ScoredAlumni } from '../../services/recommendations';
import AlumniAvatar from '../common/AlumniAvatar';

interface Props {
  alumni: ScoredAlumni | null;
  visible: boolean;
  onClose: () => void;
  onSave: (alumni: ScoredAlumni) => void;
  onPass: (alumni: ScoredAlumni) => void;
  onGenerateMessage: (alumni: ScoredAlumni) => void;
}

export default function AlumniDetailModal({
  alumni,
  visible,
  onClose,
  onSave,
  onPass,
  onGenerateMessage,
}: Props) {
  const insets = useSafeAreaInsets();
  const [copyHint, setCopyHint] = useState<string | null>(null);

  if (!alumni) return null;

  const profile = alumni.profile;

  const flashCopy = (label: string) => {
    setCopyHint(label);
    setTimeout(() => setCopyHint(null), 1600);
  };

  const handleOpenLinkedIn = () => {
    if (!profile.linkedinUrl) return;
    Linking.openURL(profile.linkedinUrl).catch(() =>
      Alert.alert('Could not open LinkedIn'),
    );
  };

  const handleCopyLinkedIn = async () => {
    if (!profile.linkedinUrl) return;
    await Clipboard.setStringAsync(profile.linkedinUrl);
    flashCopy('LinkedIn copied');
  };

  const handleOpenEmail = () => {
    if (!profile.email) return;
    Linking.openURL(`mailto:${profile.email}`).catch(() =>
      Alert.alert('Could not open email'),
    );
  };

  const handleCopyEmail = async () => {
    if (!profile.email) return;
    await Clipboard.setStringAsync(profile.email);
    flashCopy('Email copied');
  };

  const yearShort = formatGradYearShort(profile.graduationYear);
  const cornellLine = [profile.sport, yearShort ? `Class of ${profile.graduationYear}` : null]
    .filter(Boolean)
    .join(' · ');

  const metaPills = buildMetaPills(profile);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces
        >
          {/* Header — avatar, name, role */}
          <View style={styles.header}>
            <AlumniAvatar alumni={profile} size={96} />
            <Text style={styles.name}>{profile.name}</Text>
            {profile.currentRole || profile.currentCompany ? (
              <Text style={styles.role}>
                {profile.currentRole && profile.currentCompany
                  ? `${profile.currentRole}  ·  ${profile.currentCompany}`
                  : profile.currentRole ?? profile.currentCompany}
              </Text>
            ) : null}
            {cornellLine ? (
              <Text style={styles.cornellLine}>{cornellLine}</Text>
            ) : null}
          </View>

          {/* Meta pills */}
          {metaPills.length > 0 ? (
            <View style={styles.pillRow}>
              {metaPills.map((p) => (
                <View key={p} style={styles.pill}>
                  <Text style={styles.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Career summary */}
          {profile.bio ? (
            <Section label="Career Summary">
              <Text style={styles.bodyText}>{profile.bio}</Text>
            </Section>
          ) : null}

          {/* Why this match */}
          {alumni.whyThisMatch.length > 0 ? (
            <Section label="Why this match">
              <View style={{ gap: 8 }}>
                {alumni.whyThisMatch.map((reason, i) => (
                  <View key={i} style={styles.reasonRow}>
                    <View style={styles.reasonDot} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Past Experience */}
          {profile.pastExperiences.length > 0 ? (
            <Section label="Past Experience">
              <View style={styles.timeline}>
                {profile.pastExperiences.slice(0, 5).map((entry, i) => {
                  const dates = formatExperienceDates(entry);
                  return (
                    <View key={i} style={styles.timelineRow}>
                      <View style={styles.timelineColumn}>
                        <View style={styles.timelineDot} />
                        {i < Math.min(profile.pastExperiences.length, 5) - 1 ? (
                          <View style={styles.timelineLine} />
                        ) : null}
                      </View>
                      <View style={styles.timelineContent}>
                        {entry.title ? (
                          <Text style={styles.expTitle}>{entry.title}</Text>
                        ) : null}
                        {entry.company ? (
                          <Text style={styles.expCompany}>{entry.company}</Text>
                        ) : null}
                        {dates ? (
                          <Text style={styles.expDates}>{dates}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {/* Cornell Background */}
          {(profile.sport || profile.graduationYear || profile.education.length > 0) ? (
            <Section label="Cornell Background">
              <View style={{ gap: 6 }}>
                {profile.sport ? (
                  <Text style={styles.bodyText}>
                    {profile.sport}
                    {yearShort ? `  ·  Class of ${profile.graduationYear}` : ''}
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

          {/* Contact / Links */}
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
              {copyHint ? (
                <Text style={styles.copyHint}>{copyHint}</Text>
              ) : null}
            </Section>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action bar */}
        <View
          style={[
            styles.actions,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <Pressable
            style={styles.passAction}
            onPress={() => {
              onPass(alumni);
              onClose();
            }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
            <Text style={styles.passActionText}>Pass</Text>
          </Pressable>

          <Pressable
            style={styles.messageAction}
            onPress={() => onGenerateMessage(alumni)}
          >
            <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.messageActionText}>Message</Text>
          </Pressable>

          <Pressable
            style={styles.saveAction}
            onPress={() => {
              onSave(alumni);
              onClose();
            }}
          >
            <Ionicons name="bookmark" size={18} color={colors.textInverse} />
            <Text style={styles.saveActionText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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
          <Text style={styles.contactSecondary} numberOfLines={1}>
            {secondary}
          </Text>
        </View>
      </Pressable>
      <Pressable style={styles.copyButton} onPress={onCopy} hitSlop={8}>
        <Ionicons name="copy-outline" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

function buildMetaPills(profile: NormalizedAlumni): string[] {
  const pills: string[] = [];
  if (profile.industry) pills.push(profile.industry);
  if (profile.location) pills.push(profile.location);
  return pills;
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
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
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  name: {
    ...typography.title2,
    fontSize: 24,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  role: {
    ...typography.callout,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cornellLine: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pillText: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  reasonDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.red,
    marginTop: 8,
  },
  reasonText: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
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
  messageAction: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageActionText: {
    ...typography.subhead,
    color: colors.textPrimary,
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
  saveActionText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '700',
  },
});
