import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../../theme/scoutTheme';

type Status = 'saved' | 'message_drafted' | 'contacted' | 'replied' | 'meeting_set';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  saved: { label: 'Saved', color: colors.statusSaved, bg: colors.statusSavedBg },
  message_drafted: { label: 'Draft Ready', color: colors.statusDrafted, bg: colors.statusDraftedBg },
  contacted: { label: 'Contacted', color: colors.statusContacted, bg: colors.statusContactedBg },
  replied: { label: 'Replied', color: colors.statusReplied, bg: colors.statusRepliedBg },
  meeting_set: { label: 'Meeting Set', color: colors.statusMeeting, bg: colors.statusMeetingBg },
};

interface Props {
  status: Status | string;
}

export default function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status as Status] ?? {
    label: status,
    color: colors.textTertiary,
    bg: colors.borderLight,
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.caption1,
    fontWeight: '600',
  },
});
