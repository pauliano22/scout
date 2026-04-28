import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, spacing, typography } from '../../theme/scoutTheme';
import type { ScoredAlumni } from '../../services/recommendations';
import {
  formatExperienceDates,
  formatGradYearShort,
} from '../../lib/alumniProfile';
import AlumniAvatar from '../common/AlumniAvatar';

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
  const isHorizontalGesture = useRef(false);

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

  // Subtle photo zoom following swipe direction
  const photoTilt = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: [-12, 0, 12],
    extrapolate: 'clamp',
  });

  const completeSwipe = (direction: 'left' | 'right', velocityY: number) => {
    swipeAnimating.current = true;
    Animated.parallel([
      Animated.timing(position, {
        toValue: {
          x: direction === 'right' ? SCREEN_WIDTH + 140 : -SCREEN_WIDTH - 140,
          y: velocityY * 80,
        },
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      direction === 'right' ? onSwipeRight() : onSwipeLeft();
    });
  };

  const panResponder = PanResponder.create({
    // Don't capture taps — let the ScrollView and Pressables receive them
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    // Only steal the gesture when it's clearly a horizontal swipe.
    // This lets vertical scroll inside the card work naturally.
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
      isHorizontalGesture.current = true;
      Animated.spring(scale, {
        toValue: 1.015,
        friction: 8,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderMove: (_, g) => {
      // Dampen vertical drag slightly so the card feels anchored
      position.setValue({ x: g.dx, y: g.dy * 0.4 });
    },
    onPanResponderRelease: (_, g) => {
      isHorizontalGesture.current = false;
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

  const metaParts = [
    profile.industry,
    profile.sport && yearShort
      ? `${profile.sport} ${yearShort}`
      : profile.sport ?? (yearShort ? `Cornell ${yearShort}` : null),
    profile.location,
  ].filter(Boolean) as string[];

  const visibleExperiences = profile.pastExperiences.slice(0, 4);

  // Compact "Previously: A · B · C" line — past companies excluding the current one
  const previousCompanies = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const currentLower = profile.currentCompany?.toLowerCase() ?? null;
    for (const e of profile.pastExperiences) {
      const c = e?.company?.trim();
      if (!c) continue;
      const key = c.toLowerCase();
      if (key === currentLower) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= 3) break;
    }
    return out;
  })();

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* Swipe overlay badges sit above everything */}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        // Allow vertical scroll while pan is idle. PanResponder steals the gesture
        // only when horizontal motion dominates, so this composes cleanly.
        scrollEnabled={isTop}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Photo / fallback */}
        <View style={styles.media}>
          {showPhoto ? (
            <Animated.View
              style={[
                styles.photoWrapper,
                { transform: [{ translateX: photoTilt }] },
              ]}
            >
              <Image
                source={{ uri: photoUri! }}
                style={styles.photo}
                onError={() => setImageError(true)}
                resizeMode="cover"
              />
            </Animated.View>
          ) : (
            <View style={styles.photoFallback}>
              <AlumniAvatar alumni={profile} size={88} />
              <Text style={styles.photoFallbackName} numberOfLines={1}>
                {profile.firstName}
              </Text>
              <Text style={styles.photoFallbackSub} numberOfLines={1}>
                {profile.headline ?? profile.industry ?? 'Cornell Athletics Alumni'}
              </Text>
            </View>
          )}

          {showPhoto ? (
            <LinearGradient
              colors={['rgba(0,0,0,0.20)', 'rgba(0,0,0,0)']}
              style={styles.topFade}
              pointerEvents="none"
            />
          ) : null}

          {yearShort && showPhoto ? (
            <View style={styles.yearPill} pointerEvents="none">
              <Text style={styles.yearPillText}>Cornell {yearShort}</Text>
            </View>
          ) : null}

          {/* Scroll hint chevron */}
          <View style={styles.scrollHint} pointerEvents="none">
            <Ionicons name="chevron-up" size={14} color={colors.textTertiary} />
            <Text style={styles.scrollHintText}>Scroll for more</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>

          {profile.currentRole || profile.currentCompany ? (
            <Text style={styles.roleLine} numberOfLines={2}>
              {profile.currentRole && profile.currentCompany
                ? `${profile.currentRole}  ·  ${profile.currentCompany}`
                : profile.currentRole ?? profile.currentCompany}
            </Text>
          ) : null}

          {metaParts.length > 0 ? (
            <Text style={styles.metaLine} numberOfLines={2}>
              {metaParts.join('  ·  ')}
            </Text>
          ) : null}

          {previousCompanies.length > 0 ? (
            <View style={styles.previouslyRow}>
              <Text style={styles.previouslyLabel}>Previously</Text>
              <Text style={styles.previouslyText} numberOfLines={1}>
                {previousCompanies.join('  ·  ')}
              </Text>
            </View>
          ) : null}

          {profile.bio ? (
            <View style={styles.bioBlock}>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          ) : null}

          {alumni.whyThisMatch.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Why this match</Text>
              <View style={{ gap: 6 }}>
                {alumni.whyThisMatch.slice(0, 3).map((reason, i) => (
                  <View key={i} style={styles.matchRow}>
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={colors.red}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={styles.matchText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {visibleExperiences.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Past Experience</Text>
              <View style={styles.timeline}>
                {visibleExperiences.map((entry, i) => {
                  const dates = formatExperienceDates(entry);
                  return (
                    <View key={i} style={styles.timelineRow}>
                      <View style={styles.timelineColumn}>
                        <View style={styles.timelineDot} />
                        {i < visibleExperiences.length - 1 ? (
                          <View style={styles.timelineLine} />
                        ) : null}
                      </View>
                      <View style={styles.timelineContent}>
                        {entry.title ? (
                          <Text style={styles.expTitle}>{entry.title}</Text>
                        ) : null}
                        {entry.company ? (
                          <Text style={styles.expCompany}>{entry.company}</Text>
                        ) : null}
                        {dates ? <Text style={styles.expDates}>{dates}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable style={styles.viewFull} onPress={isTop ? onPress : undefined}>
            <Text style={styles.viewFullText}>View full profile</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderHairline,
    ...shadows.card,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  media: {
    width: '100%',
    height: CARD_HEIGHT * 0.5,
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
    overflow: 'hidden',
  },
  photoWrapper: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  photoFallbackName: {
    ...typography.title3,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  photoFallbackSub: {
    ...typography.footnote,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  yearPill: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  yearPillText: {
    ...typography.caption1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  scrollHint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  scrollHintText: {
    ...typography.caption2,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  name: {
    ...typography.title2,
    fontSize: 24,
    marginBottom: 4,
  },
  roleLine: {
    ...typography.callout,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 22,
  },
  metaLine: {
    ...typography.subhead,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  previouslyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: spacing.md,
  },
  previouslyLabel: {
    ...typography.caption2,
    color: colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previouslyText: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  bioBlock: {
    marginBottom: spacing.lg,
  },
  bio: {
    ...typography.subhead,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  matchText: {
    ...typography.subhead,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 21,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  timelineColumn: {
    width: 12,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.red,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 2,
    gap: 2,
  },
  expTitle: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  expCompany: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  expDates: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginTop: 1,
  },
  viewFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs,
  },
  viewFullText: {
    ...typography.subhead,
    color: colors.textPrimary,
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
