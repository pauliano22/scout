import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../../theme/scoutTheme';

interface Props {
  message: string;
  visible: boolean;
  type?: 'success' | 'error' | 'info';
}

export default function Toast({ message, visible, type = 'success' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 1,
          stiffness: 300,
          damping: 30,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          stiffness: 300,
          damping: 30,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  const bgColor =
    type === 'success' ? colors.success
    : type === 'error' ? colors.error
    : colors.textPrimary;

  const iconName =
    type === 'success' ? 'checkmark-circle'
    : type === 'error' ? 'alert-circle'
    : 'information-circle';

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: bgColor, opacity, transform: [{ translateY }] },
        ]}
      >
        <Ionicons name={iconName} size={18} color="#FFFFFF" />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    ...shadows.lg,
  },
  text: {
    ...typography.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
