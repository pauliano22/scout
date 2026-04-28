import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme/scoutTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.xl * 2;
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.66, 620);

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.media} />
      <View style={styles.body}>
        <View style={[styles.line, { width: '60%', height: 20 }]} />
        <View style={[styles.line, { width: '80%', height: 14, marginTop: spacing.sm }]} />
        <View style={[styles.line, { width: '50%', height: 12, marginTop: 6 }]} />
        <View style={[styles.line, { width: '90%', height: 12, marginTop: spacing.lg }]} />
        <View style={[styles.line, { width: '70%', height: 12, marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderHairline,
    ...shadows.md,
  },
  media: {
    width: '100%',
    height: '50%',
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.xs,
  },
  line: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xs,
  },
});
