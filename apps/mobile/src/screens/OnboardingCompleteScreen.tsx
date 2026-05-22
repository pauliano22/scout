import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import PressableScale from '../components/common/PressableScale';

interface Props {
  onEnter: () => void;
}

export default function OnboardingCompleteScreen({ onEnter }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, delay: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, stiffness: 300, damping: 30, mass: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={32} color={colors.textInverse} />
        </View>
        <Text style={styles.title}>You're all set.</Text>
        <Text style={styles.sub}>
          Discover alumni who played your sport, work in your target field, and are ready to connect.
        </Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <PressableScale style={styles.btn} onPress={onEnter}>
          <Text style={styles.btnText}>Explore Scout</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    ...typography.callout,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  btn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.sm,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
});
