import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme/scoutTheme';
import {
  formatExperienceDates,
  formatGradYearShort,
  formatSportLabel,
  type NormalizedAlumni,
} from '../../lib/alumniProfile';
import type { ScoredAlumni } from '../../services/recommendations';
import AlumniAvatar from '../common/AlumniAvatar';

const HERO_HEIGHT = 260;

interface Props {
  alumni: ScoredAlumni | null;
  visible: boolean;
  onClose: () => void;
  onSave: (alumni: ScoredAlumni) => void;
  onPass: (alumni: ScoredAlumni) => void;
}

export default function AlumniDetailModal({
  alumni,
  visible,
  onClose,
  onSave,
  onPass,
}: Props) {
  const insets = useSafeAreaInsets();
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

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
                <Text style={styles.fallbackCornell}>
                  {[profile.sport, yearShort ? `Cornell ${yearShort}` : null].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          )}

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

          {/* Cornell Background */}
          {(profile.sport || profile.graduationYear || profile.education.length > 0) ? (
            <Section label="Cornell Background">
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
          ) : null}

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

          <Pressable
            style={styles.saveAction}
            onPress={() => { onSave(alumni); onClose(); }}
          >
            <Ionicons name="bookmark" size={18} color={colors.textInverse} />
            <Text style={styles.saveActionText}>Save</Text>
          </Pressable>
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
  fallbackCornell: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
    marginTop: 2,
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
  saveActionText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '700',
  },
});
