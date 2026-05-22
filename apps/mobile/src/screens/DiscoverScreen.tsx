import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import AlumniCard from '../components/cards/AlumniCard';
import AlumniDetailModal from '../components/modals/AlumniDetailModal';
import Toast from '../components/common/Toast';
import SkeletonCard from '../components/common/SkeletonCard';
import { ScoutMark } from '../components/common/ScoutMark';
import { useRecommendations } from '../hooks/useRecommendations';
import { DAILY_LIMIT } from '../services/dailyLimit';
import type { ScoredAlumni } from '../services/recommendations';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const { deck, loading, load, swipe, rewind, canRewind, limitReached, swipeCount } =
    useRecommendations();

  const [selectedAlumni, setSelectedAlumni] = useState<ScoredAlumni | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'success' as 'success' | 'error',
  });

  const passAnim = useRef(new Animated.Value(1)).current;
  const saveAnim = useRef(new Animated.Value(1)).current;
  const viewAnim = useRef(new Animated.Value(1)).current;

  // The hook auto-refetches whenever preferences change. We only need to
  // ensure we have data on first focus (e.g., after sign-in).
  useFocusEffect(
    useCallback(() => {
      if (deck.length === 0) load();
    }, [deck.length, load]),
  );

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  }

  function bounce(anim: Animated.Value) {
    Animated.sequence([
      Animated.spring(anim, { toValue: 0.94, useNativeDriver: true, stiffness: 400, damping: 25, mass: 0.7 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, stiffness: 300, damping: 30, mass: 1 }),
    ]).start();
  }

  async function handleSwipeLeft(alumniId: string) {
    bounce(passAnim);
    await swipe(alumniId, 'pass');
  }

  async function handleSwipeRight(alumniId: string) {
    bounce(saveAnim);
    await swipe(alumniId, 'save');
    showToast('Saved to your Network');
  }

  async function handlePassButton() {
    const top = deck[0];
    if (!top) return;
    bounce(passAnim);
    await swipe(top.id, 'pass');
  }

  async function handleSaveButton() {
    const top = deck[0];
    if (!top) return;
    bounce(saveAnim);
    await swipe(top.id, 'save');
    showToast('Saved to your Network');
  }

  async function handleRewind() {
    await rewind();
    showToast('Last swipe undone');
  }

  function openDetail(alumni: ScoredAlumni) {
    bounce(viewAnim);
    setSelectedAlumni(alumni);
    setDetailVisible(true);
  }

  const visibleDeck = deck.slice(0, 3);
  const isEmpty = !loading && deck.length === 0 && !limitReached;
  const showActions = !loading && !isEmpty && !limitReached;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <ScoutMark size={24} />
            <Text style={styles.headerTitle}>Discover</Text>
          </View>
          <Text style={styles.headerSub}>
            {limitReached
              ? 'Come back tomorrow'
              : `${swipeCount} / ${DAILY_LIMIT} today`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canRewind ? (
            <Pressable
              style={styles.iconButton}
              onPress={handleRewind}
              accessibilityLabel="Rewind last swipe"
              hitSlop={8}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={colors.textPrimary} />
            </Pressable>
          ) : null}
          {!loading && !limitReached && deck.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{deck.length}</Text>
            </View>
          ) : null}
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.navigate('You')}
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Card Stack */}
      <View style={[styles.deckContainer, !showActions && { paddingBottom: tabBarHeight }]}>
        {loading ? (
          <SkeletonCard />
        ) : limitReached ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="moon-outline" size={28} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Come back tomorrow</Text>
            <Text style={styles.emptySub}>
              You've reached your {20} alumni discoveries for today. Recommendations reset at midnight.
            </Text>
            <Pressable
              style={styles.primaryCta}
              onPress={() => navigation.navigate('Network')}
            >
              <Text style={styles.primaryCtaText}>View My Network</Text>
            </Pressable>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyContainer}>
            <ScoutMark size={72} muted style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>You're caught up.</Text>
            <Text style={styles.emptySub}>
              Update your preferences or check back soon for more alumni.
            </Text>
            <Pressable
              style={styles.primaryCta}
              onPress={() => navigation.navigate('You')}
            >
              <Text style={styles.primaryCtaText}>Edit Preferences</Text>
            </Pressable>
            <Pressable style={styles.ghostCta} onPress={load}>
              <Text style={styles.ghostCtaText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          [...visibleDeck].reverse().map((alumni, reversedIndex) => {
            const index = visibleDeck.length - 1 - reversedIndex;
            const isTop = index === 0;
            return (
              <AlumniCard
                key={alumni.id}
                alumni={alumni}
                isTop={isTop}
                index={index}
                onSwipeLeft={() => handleSwipeLeft(alumni.id)}
                onSwipeRight={() => handleSwipeRight(alumni.id)}
                onPress={() => openDetail(alumni)}
              />
            );
          })
        )}
      </View>

      {/* Action buttons */}
      {showActions ? (
        <View style={[styles.actionRow, { paddingBottom: tabBarHeight }]}>
          <Animated.View style={{ transform: [{ scale: passAnim }] }}>
            <Pressable
              style={styles.passButton}
              onPress={handlePassButton}
              accessibilityLabel="Pass"
              hitSlop={8}
            >
              <Ionicons name="close" size={26} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: viewAnim }] }}>
            <Pressable
              style={styles.viewButton}
              onPress={() => deck[0] && openDetail(deck[0])}
              accessibilityLabel="View profile"
              hitSlop={8}
            >
              <Ionicons name="reader-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.viewLabel}>View</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
            <Pressable
              style={styles.saveButton}
              onPress={handleSaveButton}
              accessibilityLabel="Save"
              hitSlop={8}
            >
              <Ionicons name="bookmark" size={22} color={colors.textInverse} />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      {/* Modals */}
      <AlumniDetailModal
        alumni={selectedAlumni}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onSave={(a) => {
          handleSwipeRight(a.id);
          setDetailVisible(false);
        }}
        onPass={(a) => {
          handleSwipeLeft(a.id);
          setDetailVisible(false);
        }}
      />

      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  headerTitle: {
    ...typography.largeTitle,
  },
  headerSub: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: 6,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    ...typography.caption1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  deckContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
    width: '100%',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyMark: {
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  emptyTitle: {
    ...typography.title2,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.subhead,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  primaryCta: {
    backgroundColor: colors.red,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.lg,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryCtaText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '600',
  },
  ghostCta: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ghostCtaText: {
    ...typography.subhead,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  passButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm,
  },
  viewLabel: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  saveButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
});
