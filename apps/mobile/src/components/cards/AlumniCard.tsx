import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, spacing, typography } from '../../theme/scoutTheme';
import type { ScoredAlumni } from '../../services/recommendations';
import { formatGradYearShort, formatSportLabel } from '../../lib/alumniProfile';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = spacing.xl;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2;
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.66, 620);

const SWIPE_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_VELOCITY_THRESHOLD = 0.55;

interface Props {
  alumni: ScoredAlumni;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onPress: () => void;
  isTop: boolean;
  index: number;
}

export default function AlumniCard({
  alumni,
  onSwipeLeft,
  onSwipeRight,
  onPress,
  isTop,
  index,
}: Props) {
  const position = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [imageError, setImageError] = useState(false);
  const swipeAnimating = useRef(false);

  const profile = alumni.profile;

  const rotation = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-7deg', '0deg', '7deg'],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.18],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.18, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const photoTilt = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [-12, 0, 12],
    extrapolate: 'clamp',
  });

  const completeSwipe = (direction: 'left' | 'right', velocityY: number) => {
    swipeAnimating.current = true;
    Animated.timing(position, {
      toValue: {
        x: direction === 'right' ? SCREEN_WIDTH + 140 : -SCREEN_WIDTH - 140,
        y: velocityY * 80,
      },
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      direction === 'right' ? onSwipeRight() : onSwipeLeft();
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, g) => {
      if (!isTop) return false;
      const horizontal = Math.abs(g.dx);
      const vertical = Math.abs(g.dy);
      return horizontal > 12 && horizontal > vertical * 1.4;
    },
    onMoveShouldSetPanResponderCapture: (_, g) => {
      if (!isTop) return false;
      const horizontal = Math.abs(g.dx);
      const vertical = Math.abs(g.dy);
      return horizontal > 12 && horizontal > vertical * 1.4;
    },
    onPanResponderGrant: () => {
      Animated.spring(scale, { toValue: 1.015, friction: 8, useNativeDriver: true }).start();
    },
    onPanResponderMove: (_, g) => {
      position.setValue({ x: g.dx, y: g.dy * 0.4 });
    },
    onPanResponderRelease: (_, g) => {
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      if (swipeAnimating.current) return;
      const passedDistance = Math.abs(g.dx) > SWIPE_DISTANCE_THRESHOLD;
      const passedVelocity = Math.abs(g.vx) > SWIPE_VELOCITY_THRESHOLD;
      if ((passedDistance || passedVelocity) && g.dx > 0) {
        completeSwipe('right', g.vy);
      } else if ((passedDistance || passedVelocity) && g.dx < 0) {
        completeSwipe('left', g.vy);
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 7,
          tension: 70,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 7,
      }).start();
    },
  });

  const cardStyle = isTop
    ? {
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { rotate: rotation },
          { scale },
        ],
      }
    : {
        transform: [
          { scale: 1 - index * 0.035 },
          { translateY: index * 10 },
        ],
        opacity: 1 - index * 0.18,
      };

  const photoUri = profile.photoUrl;
  const showPhoto = !!photoUri && !imageError;
  const yearShort = formatGradYearShort(profile.graduationYear);

  const sportLabel = formatSportLabel(profile.sport);
  const tags = [
    profile.industry,
    sportLabel
      ? yearShort ? `${sportLabel} '${yearShort.slice(-2)}` : sportLabel
      : null,
    profile.location,
  ].filter(Boolean).slice(0, 3) as string[];

  const initials = getInitials(profile.name);
  const industryColor = getIndustryColor(profile.industry);
  const sportEmoji = getSportEmoji(profile.sport);

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {isTop ? (
        <>
          <Animated.View
            style={[styles.actionBadge, styles.saveBadge, { opacity: saveOpacity }]}
            pointerEvents="none"
          >
            <Text style={styles.saveBadgeText}>SAVE</Text>
          </Animated.View>
          <Animated.View
            style={[styles.actionBadge, styles.passBadge, { opacity: passOpacity }]}
            pointerEvents="none"
          >
            <Text style={styles.passBadgeText}>PASS</Text>
          </Animated.View>
        </>
      ) : null}

      {/* Full-card pressable — taps anywhere open the profile */}
      <Pressable style={styles.cardPressable} onPress={isTop ? onPress : undefined}>

        {/* Photo or styled fallback */}
        <View style={styles.photoArea}>
          {showPhoto ? (
            <Animated.View style={[styles.photoWrapper, { transform: [{ translateX: photoTilt }] }]}>
              <Image
                source={{ uri: photoUri! }}
                style={styles.photo}
                onError={() => setImageError(true)}
                resizeMode="cover"
              />
            </Animated.View>
          ) : (
            <View style={[styles.photoFallback, { backgroundColor: industryColor }]}>
              {/* Subtle top-to-bottom shading over the tint */}
              <LinearGradient
                colors={['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.30)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              {/* Sport watermark */}
              <View style={styles.sportIconBg} pointerEvents="none">
                <Text style={styles.sportEmoji}>{sportEmoji}</Text>
              </View>

              {/* Initials badge */}
              <View style={styles.initialsCircle}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>

              {profile.sport ? (
                <Text style={styles.fallbackSportLabel}>{profile.sport}</Text>
              ) : null}
            </View>
          )}

          {/* Bottom gradient — tall enough to cover name + company + role + tags */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.78)']}
            style={styles.gradient}
            pointerEvents="none"
          />

          {/* Info overlay */}
          <View style={styles.overlay}>
            <Text style={styles.name} numberOfLines={1}>{profile.name}</Text>
            {profile.currentCompany ? (
              <Text style={styles.company} numberOfLines={1}>{profile.currentCompany}</Text>
            ) : null}
            {profile.currentRole ? (
              <Text style={styles.role}>{profile.currentRole}</Text>
            ) : null}
            {tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

      </Pressable>
    </Animated.View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getIndustryColor(industry: string | null): string {
  if (!industry) return '#111114';
  const i = industry.toLowerCase();
  if (i.includes('finance') || i.includes('banking') || i.includes('investment') || i.includes('equity') || i.includes('hedge')) return '#08131C';
  if (i.includes('tech') || i.includes('software') || i.includes('saas') || i.includes('startup') || i.includes('data') || i.includes('ai')) return '#07141E';
  if (i.includes('health') || i.includes('medical') || i.includes('bio') || i.includes('pharma')) return '#081A0C';
  if (i.includes('consult')) return '#17140A';
  if (i.includes('law') || i.includes('legal')) return '#16110A';
  if (i.includes('media') || i.includes('entertainment') || i.includes('sport')) return '#14091A';
  if (i.includes('real estate') || i.includes('construction')) return '#110E08';
  return '#111114';
}

function getSportEmoji(sport: string | null): string {
  if (!sport) return '🏅';
  const s = sport.toLowerCase();
  if (s.includes('basketball'))                         return '🏀';
  if (s.includes('baseball'))                           return '⚾';
  if (s.includes('softball'))                           return '🥎';
  if (s.includes('football'))                           return '🏈';
  if (s.includes('soccer'))                             return '⚽';
  if (s.includes('volleyball'))                         return '🏐';
  if (s.includes('tennis'))                             return '🎾';
  if (s.includes('squash') || s.includes('racquetball')) return '🏸';
  if (s.includes('lacrosse'))                           return '🥍';
  if (s.includes('field hockey'))                       return '🏑';
  if (s.includes('ice hockey') || s.includes('hockey')) return '🏒';
  if (s.includes('swim'))                               return '🏊';
  if (s.includes('diving'))                             return '🤽';
  if (s.includes('water polo'))                         return '🤽';
  if (s.includes('row') || s.includes('crew'))          return '🚣';
  if (s.includes('sail') || s.includes('yacht'))        return '⛵';
  if (s.includes('track') || s.includes('sprint') || s.includes('hurdle')) return '🏃';
  if (s.includes('cross country') || s.includes('cross-country')) return '🏔️';
  if (s.includes('marathon') || s.includes('run'))      return '🏃';
  if (s.includes('golf'))                               return '⛳';
  if (s.includes('cycle') || s.includes('bike'))        return '🚴';
  if (s.includes('weight') || s.includes('lift') || s.includes('power')) return '🏋️';
  if (s.includes('fencing'))                            return '🤺';
  if (s.includes('wrestling'))                          return '🤼';
  if (s.includes('judo') || s.includes('martial'))      return '🥋';
  if (s.includes('gymnastics') || s.includes('cheer'))  return '🤸';
  if (s.includes('polo') || s.includes('equestrian') || s.includes('horse')) return '🏇';
  if (s.includes('archery'))                            return '🏹';
  if (s.includes('ski') || s.includes('skiing'))        return '⛷️';
  if (s.includes('climb') || s.includes('rock'))        return '🧗';
  if (s.includes('box') || s.includes('boxing'))        return '🥊';
  return '🏅';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderHairline,
    ...shadows.card,
  },
  cardPressable: {
    flex: 1,
  },
  photoArea: {
    flex: 1,
    position: 'relative',
  },
  photoWrapper: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },

  // No-photo fallback
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  sportIconBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportEmoji: {
    fontSize: 196,
    opacity: 0.09,
  },
  initialsCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 34,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 3,
  },
  fallbackSportLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // Gradient + overlay
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    gap: 4,
  },
  name: {
    ...typography.title2,
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
  },
  company: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.1,
  },
  role: {
    ...typography.subhead,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '400',
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tagText: {
    ...typography.caption1,
    color: '#fff',
    fontWeight: '600',
  },
  actionBadge: {
    position: 'absolute',
    top: spacing.xl + 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 2.5,
    zIndex: 20,
  },
  saveBadge: {
    left: spacing.xl,
    borderColor: colors.red,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transform: [{ rotate: '-12deg' }],
  },
  saveBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.red,
    letterSpacing: 2,
  },
  passBadge: {
    right: spacing.xl,
    borderColor: colors.textTertiary,
    backgroundColor: 'rgba(255,255,255,0.95)',
    transform: [{ rotate: '12deg' }],
  },
  passBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
