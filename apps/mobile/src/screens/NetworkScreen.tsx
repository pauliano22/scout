import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme/scoutTheme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AlumniAvatar from '../components/common/AlumniAvatar';
import StatusBadge from '../components/common/StatusBadge';
import AlumniDetailModal from '../components/modals/AlumniDetailModal';
import GenerateMessageModal from '../components/modals/GenerateMessageModal';
import {
  formatGradYearShort,
  normalizeAlumniProfile,
  type NormalizedAlumni,
} from '../lib/alumniProfile';
import type { Alumni } from '../types/database';
import type { ScoredAlumni } from '../services/recommendations';

interface NetworkEntry {
  id: string;
  alumni_id: string;
  contacted: boolean;
  status?: string;
  created_at: string;
  alumni: Alumni;
  profile: NormalizedAlumni;
}

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'saved', label: 'Saved' },
  { id: 'message_drafted', label: 'Drafted' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'meeting_set', label: 'Meeting' },
];

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [network, setNetwork] = useState<NetworkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [selectedAlumni, setSelectedAlumni] = useState<ScoredAlumni | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [messageAlumni, setMessageAlumni] = useState<ScoredAlumni | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);

  const fetchNetwork = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_networks')
        .select(`
          id,
          alumni_id,
          contacted,
          status,
          created_at,
          alumni (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const valid = (data as any[])
          .filter((n) => n.alumni && typeof n.alumni === 'object')
          .map((n) => ({
            ...n,
            profile: normalizeAlumniProfile(n.alumni),
          })) as NetworkEntry[];
        setNetwork(valid);
      }
    } catch {
      // Fail gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNetwork();
    }, [fetchNetwork]),
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchNetwork();
  }

  function openDetail(entry: NetworkEntry) {
    setSelectedAlumni({
      ...entry.alumni,
      profile: entry.profile,
      score: 0,
      scoreBreakdown: {} as any,
      whyThisMatch: [],
    } as ScoredAlumni);
    setDetailVisible(true);
  }

  function handleGenerateMessage(alumni: ScoredAlumni) {
    setMessageAlumni(alumni);
    setDetailVisible(false);
    setTimeout(() => setMessageVisible(true), 240);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return network.filter((entry) => {
      const p = entry.profile;

      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.currentCompany && p.currentCompany.toLowerCase().includes(q)) ||
        (p.currentRole && p.currentRole.toLowerCase().includes(q)) ||
        (p.industry && p.industry.toLowerCase().includes(q));

      const status = entry.status ?? 'saved';
      const matchStatus = statusFilter === 'All' || status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [network, search, statusFilter]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Network</Text>
        <Text style={styles.headerSub}>
          {network.length} {network.length === 1 ? 'connection' : 'connections'}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, role, or company"
            placeholderTextColor={colors.textDisabled}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textDisabled} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipScrollContent}
      >
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s.id;
          return (
            <Pressable
              key={s.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setStatusFilter(s.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.red} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.red}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              {network.length === 0 ? (
                <>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="bookmark-outline" size={28} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.emptyTitle}>No connections yet</Text>
                  <Text style={styles.emptySub}>
                    Swipe right on alumni in Discover to save them here.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="search-outline" size={26} color={colors.textTertiary} />
                  </View>
                  <Text style={styles.emptyTitle}>No results</Text>
                  <Text style={styles.emptySub}>
                    Try adjusting your search or filters.
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.listGroup}>
              {filtered.map((entry, i) => (
                <NetworkRow
                  key={entry.id}
                  entry={entry}
                  isFirst={i === 0}
                  isLast={i === filtered.length - 1}
                  onPress={() => openDetail(entry)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modals */}
      <AlumniDetailModal
        alumni={selectedAlumni}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onSave={() => setDetailVisible(false)}
        onPass={() => setDetailVisible(false)}
        onGenerateMessage={handleGenerateMessage}
      />

      <GenerateMessageModal
        alumni={messageAlumni}
        senderName={profile?.full_name ?? 'A Cornell Athlete'}
        senderSport={profile?.sport}
        senderYear={profile?.graduation_year}
        visible={messageVisible}
        onClose={() => setMessageVisible(false)}
      />
    </View>
  );
}

interface NetworkRowProps {
  entry: NetworkEntry;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}

function NetworkRow({ entry, isFirst, isLast, onPress }: NetworkRowProps) {
  const p = entry.profile;
  const yearShort = formatGradYearShort(p.graduationYear);

  const meta = [p.sport, yearShort ? `Cornell ${yearShort}` : null]
    .filter(Boolean)
    .join(' · ');

  const roleLine = [p.currentRole, p.currentCompany].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        !isLast && styles.rowDivider,
      ]}
      onPress={onPress}
    >
      <AlumniAvatar alumni={p} size={48} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {p.name}
          </Text>
          <StatusBadge status={entry.status ?? 'saved'} />
        </View>
        {roleLine ? (
          <Text style={styles.rowRole} numberOfLines={1}>
            {roleLine}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.largeTitle,
    marginBottom: 2,
  },
  headerSub: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.callout,
    color: colors.textPrimary,
    padding: 0,
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  chipScrollContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipText: {
    ...typography.footnote,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
  },
  listGroup: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxxxl,
    gap: spacing.sm,
    paddingHorizontal: spacing.xxxl,
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
  emptyTitle: {
    ...typography.title3,
    textAlign: 'center',
  },
  emptySub: {
    ...typography.subhead,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  rowFirst: {},
  rowLast: {},
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowName: {
    ...typography.headline,
    flex: 1,
  },
  rowRole: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  rowMeta: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
});
