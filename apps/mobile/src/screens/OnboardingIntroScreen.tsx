import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { ScoutMark } from '../components/common/ScoutMark';
import PressableScale from '../components/common/PressableScale';

interface Props {
  onBegin: () => void;
}

const STEPS = [
  { icon: 'medal-outline' as const, text: 'Your sport and graduation year' },
  { icon: 'briefcase-outline' as const, text: 'Industries and roles you\'re exploring' },
  { icon: 'compass-outline' as const, text: 'Where you are in your job search' },
  { icon: 'location-outline' as const, text: 'Cities where you want to work' },
];

export default function OnboardingIntroScreen({ onBegin }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, delay: 60, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 280, delay: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
        <ScoutMark size={52} style={styles.mark} />

        <Text style={styles.headline}>One minute setup.</Text>
        <Text style={styles.sub}>We'll use this to find alumni worth meeting.</Text>

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon} size={18} color={colors.red} />
              </View>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <PressableScale style={styles.btn} onPress={onBegin}>
          <Text style={styles.btnText}>Get Started</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  mark: {
    marginBottom: spacing.xl,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  sub: {
    ...typography.callout,
    color: colors.textTertiary,
    lineHeight: 22,
    marginBottom: spacing.xxxl,
  },
  steps: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.redDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    ...typography.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  btn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.sm,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
});
