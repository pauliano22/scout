import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import AlumniAvatar from '../components/common/AlumniAvatar';
import TagInput from '../components/common/TagInput';
import PressableScale from '../components/common/PressableScale';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/api';
import { INTEREST_SUGGESTIONS } from '@scout/shared/constants/interests';

const SPORTS = [
  'Basketball', 'Soccer', 'Football', 'Lacrosse', 'Tennis', 'Swimming',
  'Baseball', 'Volleyball', 'Hockey', 'Track & Field', 'Rowing', 'Wrestling',
  'Golf', 'Field Hockey', 'Cross Country', 'Fencing', 'Gymnastics',
];

const LOCATION_SUGGESTIONS = [
  'New York', 'San Francisco', 'Boston', 'Chicago', 'Los Angeles',
  'Washington DC', 'Seattle', 'Austin', 'Houston', 'Miami',
  'Atlanta', 'Denver', 'Philadelphia', 'Dallas', 'Minneapolis',
];

const ROLE_SUGGESTIONS = [
  'Investment Banking Analyst', 'Software Engineer', 'Product Manager',
  'Management Consultant', 'Financial Analyst', 'Marketing Manager',
  'Data Analyst', 'Sales', 'Operations', 'Strategy', 'Account Executive',
  'Associate Consultant', 'Analyst', 'Associate', 'Engineer',
];

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}

function ToggleRow({ label, sub, value, onChange, last }: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, last && styles.toggleRowLast]}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.red }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

interface ProfileCardProps {
  userId: string;
  profile: import('../types/database').Profile | null;
  onProfileSaved: () => Promise<void>;
}

function ProfileCard({ userId, profile, onProfileSaved }: ProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftSport, setDraftSport] = useState('');
  const [draftYear, setDraftYear] = useState('');
  const [draftMajor, setDraftMajor] = useState('');
  // localAvatarUri holds a freshly-picked image URI before it's been uploaded,
  // so the UI updates immediately without waiting for the round-trip.
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);

  function startEdit() {
    setDraftName(profile?.full_name ?? '');
    setDraftSport(profile?.sport ?? '');
    setDraftYear(profile?.graduation_year ? String(profile.graduation_year) : '');
    setDraftMajor(profile?.major ?? '');
    setLocalAvatarUri(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setLocalAvatarUri(null);
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setLocalAvatarUri(asset.uri);
    setUploadingAvatar(true);

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = `${userId}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      await onProfileSaved();
    } catch {
      Alert.alert('Upload failed', 'Could not save your photo. Please try again.');
      setLocalAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    const yearNum = draftYear.trim() ? parseInt(draftYear.trim(), 10) : null;
    if (draftYear.trim() && (isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
      Alert.alert('Invalid year', 'Enter a 4-digit graduation year, e.g. 2027.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: draftName.trim() || null,
          sport: draftSport.trim() || null,
          graduation_year: yearNum,
          major: draftMajor.trim() || null,
        })
        .eq('id', userId);

      if (error) throw error;

      await onProfileSaved();
      setEditing(false);
    } catch {
      Alert.alert('Save failed', 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const displayAvatarUri = localAvatarUri ?? profile?.avatar_url ?? null;
  const avatarSubject = {
    name: profile?.full_name ?? 'You',
    photoUrl: displayAvatarUri,
  };

  const yearShort = profile?.graduation_year
    ? `'${String(profile.graduation_year).slice(-2)}`
    : null;
  const sportLine = [profile?.sport, yearShort ? `Class of ${yearShort}` : null]
    .filter(Boolean)
    .join('  ·  ');

  if (editing) {
    return (
      <View style={styles.profileCard}>
        {/* Avatar with camera overlay */}
        <Pressable onPress={pickAvatar} style={styles.avatarWrap} disabled={uploadingAvatar}>
          <AlumniAvatar alumni={avatarSubject} size={72} />
          <View style={styles.cameraBadge}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Ionicons name="camera" size={14} color={colors.textInverse} />
            )}
          </View>
        </Pressable>

        {/* Edit fields */}
        <View style={styles.editFields}>
          <TextInput
            style={styles.editInput}
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Full name"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={styles.editInput}
            value={draftSport}
            onChangeText={setDraftSport}
            placeholder="Sport (e.g. Lacrosse)"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={styles.editInput}
            value={draftYear}
            onChangeText={setDraftYear}
            placeholder="Grad year (e.g. 2027)"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
            maxLength={4}
          />
          <TextInput
            style={[styles.editInput, styles.editInputLast]}
            value={draftMajor}
            onChangeText={setDraftMajor}
            placeholder="Major"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Save / Cancel */}
        <View style={styles.editActions}>
          <PressableScale style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </PressableScale>
          <PressableScale
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.profileCard}>
      <Pressable onPress={pickAvatar} style={styles.avatarWrap} disabled={uploadingAvatar}>
        {displayAvatarUri ? (
          <Image source={{ uri: displayAvatarUri }} style={styles.avatarImage} />
        ) : (
          <AlumniAvatar alumni={avatarSubject} size={72} />
        )}
        {uploadingAvatar && (
          <View style={[styles.cameraBadge, styles.cameraBadgeUploading]}>
            <ActivityIndicator size="small" color={colors.textInverse} />
          </View>
        )}
      </Pressable>
      <View style={styles.profileText}>
        <Text style={styles.profileName} numberOfLines={1}>
          {profile?.full_name ?? 'Student Athlete'}
        </Text>
        {sportLine ? (
          <Text style={styles.profileSport} numberOfLines={1}>
            {sportLine}
          </Text>
        ) : null}
        {profile?.major ? (
          <Text style={styles.profileMajor} numberOfLines={1}>
            {profile.major}
          </Text>
        ) : null}
      </View>
      <PressableScale style={styles.editIconBtn} onPress={startEdit} hitSlop={8}>
        <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
      </PressableScale>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { prefs, setPrefs, saving, lastSavedAt } = usePreferences();

  const [savedFlash, setSavedFlash] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setSavedFlash(true);
    const t = setTimeout(() => setSavedFlash(false), 1400);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your profile, network, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
    );
  }

  async function confirmDeleteAccount() {
    if (!user) return;
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('No session');

      const response = await fetch(`${WEB_API_BASE_URL}/api/profile/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      await signOut();
    } catch (err: any) {
      setDeletingAccount(false);
      Alert.alert(
        'Could not delete account',
        err?.message ?? 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sm, paddingBottom: tabBarHeight + spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>You</Text>
      </View>

      {/* Profile card with inline editing */}
      {user && (
        <ProfileCard
          userId={user.id}
          profile={profile}
          onProfileSaved={refreshProfile}
        />
      )}

      {/* ── Career Interests ─────────────────────────── */}
      <SectionHeader title="Career Interests" sub="Industries and roles you're targeting" />
      <View style={styles.card}>
        <TagInput
          compact
          label="Industries"
          placeholder="e.g. Government / Policy"
          suggestions={INTEREST_SUGGESTIONS}
          tags={prefs.industries}
          onAdd={(tag) => setPrefs((p) => ({ ...p, industries: [...p.industries, tag] }))}
          onRemove={(tag) =>
            setPrefs((p) => ({ ...p, industries: p.industries.filter((i) => i !== tag) }))
          }
        />
        <TagInput
          compact
          label="Roles"
          placeholder="e.g. Financial Analyst"
          suggestions={ROLE_SUGGESTIONS}
          tags={prefs.roles}
          onAdd={(tag) => setPrefs((p) => ({ ...p, roles: [...p.roles, tag] }))}
          onRemove={(tag) =>
            setPrefs((p) => ({ ...p, roles: p.roles.filter((r) => r !== tag) }))
          }
          style={{ marginBottom: 0 }}
        />
      </View>

      {/* ── Discovery ────────────────────────────────── */}
      <SectionHeader title="Discovery" sub="Who Scout surfaces for you" />
      <View style={styles.card}>
        <TagInput
          compact
          label="Sports"
          placeholder="e.g. Lacrosse"
          suggestions={SPORTS}
          tags={prefs.sports}
          onAdd={(tag) => setPrefs((p) => ({ ...p, sports: [...p.sports, tag] }))}
          onRemove={(tag) =>
            setPrefs((p) => ({ ...p, sports: p.sports.filter((s) => s !== tag) }))
          }
        />
        <TagInput
          compact
          label="Locations"
          placeholder="e.g. New York"
          suggestions={LOCATION_SUGGESTIONS}
          tags={prefs.locations}
          onAdd={(tag) => setPrefs((p) => ({ ...p, locations: [...p.locations, tag] }))}
          onRemove={(tag) =>
            setPrefs((p) => ({ ...p, locations: p.locations.filter((l) => l !== tag) }))
          }
        />
        <TagInput
          compact
          label="Target Companies"
          placeholder="e.g. Goldman Sachs"
          suggestions={[]}
          hint="Alumni who worked here get prioritized."
          tags={prefs.companies ?? []}
          onAdd={(tag) => setPrefs((p) => ({ ...p, companies: [...(p.companies ?? []), tag] }))}
          onRemove={(tag) =>
            setPrefs((p) => ({ ...p, companies: (p.companies ?? []).filter((c) => c !== tag) }))
          }
          style={{ marginBottom: spacing.md }}
        />

        <View style={styles.priorityDivider}>
          <Text style={styles.priorityTitle}>Priorities</Text>
        </View>
        <ToggleRow
          label="Same sport"
          sub="Boost alumni who played your sport"
          value={prefs.priorities.sameSport}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, priorities: { ...p.priorities, sameSport: v } }))
          }
        />
        <ToggleRow
          label="Similar industry"
          sub="Prioritize your target industries"
          value={prefs.priorities.similarIndustry}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, priorities: { ...p.priorities, similarIndustry: v } }))
          }
        />
        <ToggleRow
          label="Senior alumni"
          sub="Prefer alumni 10+ years out"
          value={prefs.priorities.seniorAlumni}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, priorities: { ...p.priorities, seniorAlumni: v } }))
          }
          last
        />
      </View>

      {/* Autosave indicator */}
      <View style={styles.autosaveRow}>
        <Ionicons
          name={
            saving ? 'sync-outline' : savedFlash ? 'checkmark-circle' : 'cloud-done-outline'
          }
          size={14}
          color={savedFlash ? colors.success : colors.textTertiary}
        />
        <Text style={styles.autosaveText}>
          {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Changes save automatically'}
        </Text>
      </View>

      {/* ── Account ──────────────────────────────────── */}
      <SectionHeader title="Account" />
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user?.email ?? ''}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>Scout · Athlete Network</Text>
        </View>
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>

      <PressableScale style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </PressableScale>

      <PressableScale
        style={[styles.deleteBtn, deletingAccount && styles.deleteBtnDisabled]}
        onPress={handleDeleteAccount}
        disabled={deletingAccount}
      >
        {deletingAccount ? (
          <ActivityIndicator size="small" color={colors.textTertiary} />
        ) : (
          <Text style={styles.deleteText}>Delete Account</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  headerRow: {
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.largeTitle,
  },
  // Profile card — centered, with edit icon in corner
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
    ...shadows.sm,
  },
  avatarWrap: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cameraBadgeUploading: {
    backgroundColor: colors.red,
  },
  profileText: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    ...typography.title2,
    textAlign: 'center',
  },
  profileSport: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileMajor: {
    ...typography.caption1,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  editIconBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Edit mode fields
  editFields: {
    width: '100%',
    gap: spacing.sm,
  },
  editInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.callout,
    color: colors.textPrimary,
  },
  editInputLast: {
    marginBottom: 0,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  cancelBtnText: {
    ...typography.subhead,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '600',
  },
  // Section headers
  sectionHeader: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.title3,
  },
  sectionSub: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: 2,
  },
  // Generic card container
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  // Priorities sub-section inside Discovery card
  priorityDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  priorityTitle: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  toggleRowLast: {
    borderBottomWidth: 0,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.md,
  },
  toggleLabel: {
    ...typography.subhead,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  toggleSub: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
  // Autosave indicator
  autosaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  autosaveText: {
    ...typography.caption1,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  // Account info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  infoValue: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  signOutText: {
    ...typography.subhead,
    color: colors.error,
    fontWeight: '600',
  },
  // Delete account — muted so it doesn't compete visually with Sign Out
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: 2,
    minHeight: 44,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteText: {
    ...typography.footnote,
    color: colors.textDisabled,
    fontWeight: '500',
  },
});
