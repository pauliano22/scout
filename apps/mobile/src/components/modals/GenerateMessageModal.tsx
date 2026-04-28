import React, { useMemo, useState } from 'react';
import {
  Alert,
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
import { normalizeAlumniProfile, type NormalizedAlumni } from '../../lib/alumniProfile';
import type { Alumni } from '../../types/database';

interface Props {
  alumni: (Alumni & { profile?: NormalizedAlumni }) | null;
  senderName: string;
  senderSport?: string | null;
  senderYear?: number | null;
  visible: boolean;
  onClose: () => void;
}

function generateMessage(
  profile: NormalizedAlumni,
  senderName: string,
  senderSport: string | null | undefined,
  senderYear: number | null | undefined,
): string {
  const greeting = `Hi ${profile.firstName}`;
  const yearTag = senderYear ? ` ('${String(senderYear).slice(-2)})` : '';
  const intro = `My name is ${senderName}, and I'm a ${senderSport ?? 'student-athlete'} at Cornell${yearTag}.`;

  const connection =
    profile.sport && senderSport && profile.sport.toLowerCase() === senderSport.toLowerCase()
      ? `I saw that you played ${profile.sport} at Cornell — I'd love to connect with a fellow ${profile.sport} alum.`
      : `I came across your profile on Scout and was impressed by your path.`;

  const interest = profile.currentCompany
    ? `I'm really interested in ${profile.industry ?? 'your field'} and would love to learn more about your experience at ${profile.currentCompany}.`
    : `I'm really interested in ${profile.industry ?? 'your field'} and would love to learn from your journey.`;

  const ask = `Would you be open to a quick 15-minute chat? I'd love any advice you might have for a student-athlete starting out.`;

  return `${greeting},\n\n${intro} ${connection}\n\n${interest}\n\n${ask}\n\nThank you so much for your time!\n${senderName}`;
}

export default function GenerateMessageModal({
  alumni,
  senderName,
  senderSport,
  senderYear,
  visible,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const profile = useMemo<NormalizedAlumni | null>(() => {
    if (!alumni) return null;
    return alumni.profile ?? normalizeAlumniProfile(alumni);
  }, [alumni]);

  if (!profile) return null;

  const message = generateMessage(profile, senderName, senderSport, senderYear);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      Alert.alert('Could not copy to clipboard');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Message Draft</Text>
          <Text style={styles.subtitle}>Personalized for {profile.firstName}</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{message}</Text>
          </View>

          <Text style={styles.tip}>
            Tip: Personalize before sending — mention something specific about their career.
          </Text>
        </ScrollView>

        <View
          style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <Pressable style={styles.copyButton} onPress={handleCopy}>
            {copied ? (
              <>
                <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                <Text style={styles.copyButtonText}>Copied</Text>
              </>
            ) : (
              <>
                <Ionicons name="copy-outline" size={18} color={colors.textInverse} />
                <Text style={styles.copyButtonText}>Copy Message</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.closeButtonAction} onPress={onClose}>
            <Text style={styles.closeButtonActionText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.title2,
    fontSize: 24,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  messageCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  messageText: {
    ...typography.callout,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  tip: {
    ...typography.footnote,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  copyButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  copyButtonText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '600',
  },
  closeButtonAction: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  closeButtonActionText: {
    ...typography.headline,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
