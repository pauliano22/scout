import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';

interface Props {
  onSignIn: () => void;
  onCreateAccount: () => void;
}

export default function WelcomeScreen({ onSignIn, onCreateAccount }: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 700, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>

      {/* Hero */}
      <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
        <View style={styles.logoMark}>
          <View style={styles.logoCorner} />
          <Text style={styles.logoS}>S</Text>
        </View>
        <Text style={styles.wordmark}>Scout</Text>
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
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onCreateAccount}
        >
          <Text style={styles.primaryBtnText}>Create Account</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={onSignIn}
        >
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </Pressable>

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
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  logoCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    backgroundColor: colors.red,
  },
  logoS: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.red,
    letterSpacing: -1,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xxxl,
  },
  headline: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
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
    paddingVertical: 16,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.75,
  },
  legal: {
    ...typography.caption1,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
