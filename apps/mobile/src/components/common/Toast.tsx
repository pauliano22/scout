import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/scoutTheme';

interface Props {
  message: string;
  visible: boolean;
  type?: 'success' | 'error' | 'info';
}

export default function Toast({ message, visible, type = 'success' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  const bgColor =
    type === 'success' ? colors.success
    : type === 'error' ? colors.error
    : colors.textSecondary;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bgColor, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: spacing.xl,
    right: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    ...typography.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
