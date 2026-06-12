import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authedFetch } from '../lib/api';
import { colors, radius, spacing, typography } from '../theme/scoutTheme';

// "Cornell Circle" — who this alum was on campus with, and the warm paths into
// them through the student's own saved network. Fed by
// GET /api/alumni/[id]/circle; renders nothing until data arrives and stays
// silent on any failure (rule: circle intel must never break the modal).

interface CircleTeammate {
  id: string;
  name: string;
  gradYear: number | null;
  sports: string[];
  seasons: number;
  company: string | null;
}

interface CircleWarmPath {
  alumniId: string;
  name: string;
  gradYear: number | null;
  relation: 'teammate' | 'same_era';
  seasons: number;
  status: string | null;
}

interface Circle {
  person: { campusStart: number | null; campusEnd: number | null };
  teammatesCount: number;
  eraCount: number;
  teammates: CircleTeammate[];
  warmPaths: CircleWarmPath[];
}

interface Props {
  alumniId: string | null;
  visible: boolean;
}

function shortYear(y: number | null): string {
  return y ? ` '${String(y).slice(2)}` : '';
}

function seasonsLabel(p: { relation?: string; seasons: number }): string {
  if (p.relation === 'same_era' || p.seasons === 0) return 'On campus together';
  return `Played together ${p.seasons} season${p.seasons === 1 ? '' : 's'}`;
}

export default function CornellCircleSection({ alumniId, visible }: Props) {
  const [circle, setCircle] = useState<Circle | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!visible || !alumniId || fetchedFor.current === alumniId) return;
    fetchedFor.current = alumniId;
    setCircle(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(`/api/alumni/${alumniId}/circle?limit=5`);
        if (!res.ok) return;
        const data = (await res.json()) as Circle;
        if (!cancelled) setCircle(data);
      } catch {
        // Fail silently — the section simply doesn't render.
      }
    })();
    return () => { cancelled = true; };
  }, [visible, alumniId]);

  if (!circle || (circle.teammates.length === 0 && circle.warmPaths.length === 0)) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Cornell Circle</Text>

      {circle.warmPaths.length > 0 ? (
        <View style={styles.warmGroup}>
          {circle.warmPaths.slice(0, 3).map((w) => (
            <View key={w.alumniId} style={styles.warmRow}>
              <Ionicons
                name={w.relation === 'teammate' ? 'people' : 'school-outline'}
                size={16}
                color={colors.statusMeeting}
                style={styles.warmIcon}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>
                  {w.name}
                  {shortYear(w.gradYear)}
                  <Text style={styles.inNetwork}>  ·  In your network</Text>
                </Text>
                <Text style={styles.rowMeta}>
                  {seasonsLabel(w)} — ask them for the intro
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {circle.teammates.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {circle.teammates.map((t) => (
            <View key={t.id} style={styles.mateRow}>
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>
                  {t.name}
                  {shortYear(t.gradYear)}
                </Text>
                <Text style={styles.rowMeta}>
                  {seasonsLabel(t)}
                  {t.company ? `  ·  ${t.company}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.footerText}>
        {circle.teammatesCount.toLocaleString()} teammates
        {circle.eraCount > 0 ? `  ·  ${circle.eraCount.toLocaleString()} more on campus at the same time` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  warmGroup: {
    backgroundColor: colors.statusMeetingBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  warmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warmIcon: {
    marginTop: 2,
    marginRight: spacing.sm,
  },
  mateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    ...typography.callout,
    color: colors.textPrimary,
  },
  inNetwork: {
    ...typography.caption1,
    color: colors.statusMeeting,
  },
  rowMeta: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  footerText: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
