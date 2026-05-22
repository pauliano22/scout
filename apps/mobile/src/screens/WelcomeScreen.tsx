import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { ScoutMark, Wordmark } from '../components/common/ScoutMark';
import PressableScale from '../components/common/PressableScale';

interface Props {
  onSignIn: () => void;
  onCreateAccount: () => void;
}

export default function WelcomeScreen({ onSignIn, onCreateAccount }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(16)).current;
  const markScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, delay: 60, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 280, delay: 60, useNativeDriver: true }),
      Animated.spring(markScale, { toValue: 1, stiffness: 300, damping: 30, mass: 1, delay: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>

      {/* Hero */}
      <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
        <Animated.View style={[styles.mark, { transform: [{ scale: markScale }] }]}>
          <ScoutMark size={64} />
        </Animated.View>
        <Wordmark style={styles.wordmark} />
        <Text style={styles.headline}>Your network{'\n'}starts here.</Text>
        <Text style={styles.sub}>
          Connect with athletes who've built{'\n'}careers you want.
        </Text>
      </Animated.View>

      {/* CTAs */}
      <Animated.View
        style={[
          styles.ctas,
          { opacity: fadeAnim, transform: [{ translateY: riseAnim }] },
        ]}
      >
        <PressableScale style={styles.primaryBtn} onPress={onCreateAccount}>
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </PressableScale>

        <PressableScale style={styles.secondaryBtn} onPress={onSignIn}>
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </PressableScale>

        <Text style={styles.legal}>Athletes only · Your data is never sold</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mark: {
    marginBottom: spacing.lg,
  },
  wordmark: {
    marginBottom: spacing.xxxl,
  },
  headline: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: spacing.md,
  },
  sub: {
    ...typography.callout,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
  },
  ctas: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    backgroundColor: colors.redDim,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.red,
    letterSpacing: -0.2,
  },
  legal: {
    ...typography.caption1,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
