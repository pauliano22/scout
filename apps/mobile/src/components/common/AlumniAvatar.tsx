import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/scoutTheme';
import type { Alumni } from '../../types/database';
import type { NormalizedAlumni } from '../../lib/alumniProfile';

interface Props {
  alumni:
    | Pick<Alumni, 'full_name' | 'avatar_url' | 'photo_url'>
    | Pick<NormalizedAlumni, 'name' | 'photoUrl'>
    | { name?: string; full_name?: string; photoUrl?: string | null; avatar_url?: string | null; photo_url?: string | null };
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  if (!name) return '–';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function AlumniAvatar({ alumni, size = 44, style }: Props) {
  const [imageError, setImageError] = useState(false);

  const a = alumni as Record<string, unknown>;
  const name = (a.name as string | undefined) ?? (a.full_name as string | undefined) ?? '';
  const photoUri =
    (a.photoUrl as string | undefined) ??
    (a.photo_url as string | undefined) ??
    (a.avatar_url as string | undefined) ??
    null;

  const showImage = !!photoUri && !imageError;
  const initials = getInitials(name);

  if (showImage) {
    const imageStyle: ImageStyle = {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.surfaceMuted,
    };
    return (
      <View style={[styles.shell, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={{ uri: photoUri! }}
          style={imageStyle}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.36,
          color: colors.textSecondary,
          fontWeight: '600',
          letterSpacing: 0.5,
        }}
        allowFontScaling={false}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  fallback: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
