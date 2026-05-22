import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../theme/scoutTheme';

interface ScoutMarkProps {
  size?: number;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The Scout monogram: rounded square with a corner notch and an "S".
// `muted` renders it as a faded neutral watermark for empty states.
export function ScoutMark({ size = 64, muted = false, style }: ScoutMarkProps) {
  const corner = Math.round(size * 0.3);
  const accent = muted ? colors.border : colors.red;
  return (
    <View
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.16),
          borderColor: accent,
        },
        !muted && shadows.sm,
        style,
      ]}
    >
      <View
        style={[
          styles.corner,
          { width: corner, height: corner, backgroundColor: accent },
        ]}
      />
      <Text
        style={[
          styles.s,
          { fontSize: Math.round(size * 0.46), color: muted ? colors.textDisabled : colors.red },
        ]}
      >
        S
      </Text>
    </View>
  );
}

interface WordmarkProps {
  style?: StyleProp<TextStyle>;
}

export function Wordmark({ style }: WordmarkProps) {
  return <Text style={[styles.wordmark, style]}>Scout</Text>;
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  s: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
});
