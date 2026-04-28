import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme/scoutTheme';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../services/recommendations';
import AlumniAvatar from '../components/common/AlumniAvatar';

const INDUSTRIES = [
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
  'Real Estate',
  'Private Equity',
  'Marketing',
  'Other',
];
const SPORTS = [
  'Basketball',
  'Soccer',
  'Football',
  'Lacrosse',
  'Tennis',
  'Swimming',
  'Baseball',
  'Volleyball',
  'Hockey',
  'Track & Field',
  'Rowing',
  'Wrestling',
  'Golf',
  'Field Hockey',
  'Cross Country',
  'Fencing',
  'Gymnastics',
];
const LOCATIONS = [
  'New York',
  'San Francisco',
  'Boston',
  'Chicago',
  'Los Angeles',
  'Washington DC',
  'Seattle',
  'Austin',
  'Houston',
  'Miami',
];

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  function toggle(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }

  return (
    <View style={msStyles.container}>
      <Text style={msStyles.label}>{label}</Text>
      <View style={msStyles.options}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Pressable
              key={opt}
              style={[msStyles.chip, active && msStyles.chipActive]}
              onPress={() => toggle(opt)}
            >
              <Text style={[msStyles.chipText, active && msStyles.chipTextActive]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const msStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
});

interface CompanyInputProps {
  companies: string[];
  onChange: (val: string[]) => void;
}

function CompanyInput({ companies, onChange }: CompanyInputProps) {
  const [draft, setDraft] = useState('');

  function addCurrent() {
    const value = draft.trim();
    if (!value) return;
    if (companies.some((c) => c.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...companies, value]);
    setDraft('');
  }

  function remove(name: string) {
    onChange(companies.filter((c) => c !== name));
  }

  return (
    <View style={msStyles.container}>
      <Text style={msStyles.label}>Target Companies</Text>
      <Text style={ciStyles.help}>
        Alumni who worked here — current or past — get prioritized.
      </Text>

      <View style={ciStyles.inputRow}>
        <TextInput
          style={ciStyles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a company"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={addCurrent}
        />
        <Pressable
          style={[ciStyles.addButton, !draft.trim() && ciStyles.addButtonDisabled]}
          onPress={addCurrent}
          disabled={!draft.trim()}
        >
          <Ionicons name="add" size={20} color={colors.textInverse} />
        </Pressable>
      </View>

      {companies.length > 0 ? (
        <View style={ciStyles.chips}>
          {companies.map((c) => (
            <Pressable key={c} style={ciStyles.chip} onPress={() => remove(c)}>
              <Text style={ciStyles.chipText}>{c}</Text>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const ciStyles = StyleSheet.create({
  help: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.callout,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipText: {
    ...typography.footnote,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();

  const [prefs, setPrefs] = useState<UserPreferences>({
    industries: [],
    sports: [],
    locations: [],
    roles: [],
    companies: [],
    priorities: {
      sameSport: true,
      similarIndustry: true,
      seniorAlumni: false,
    },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      fetchUserPreferences(user.id).then((p) => {
        setPrefs(p);
      });
    }, [user]),
  );

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await saveUserPreferences(user.id, prefs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  const avatarSubject = {
    name: profile?.full_name ?? user?.email ?? 'You',
    photoUrl: profile?.avatar_url ?? null,
  };

  const yearShort = profile?.graduation_year
    ? `'${String(profile.graduation_year).slice(-2)}`
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>You</Text>
      </View>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <AlumniAvatar alumni={avatarSubject} size={64} />
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile?.full_name ?? 'Student Athlete'}
          </Text>
          {profile?.sport ? (
            <Text style={styles.profileMeta} numberOfLines={1}>
              {profile.sport}
              {yearShort ? `  ·  Cornell ${yearShort}` : ''}
            </Text>
          ) : null}
          <Text style={styles.profileEmail} numberOfLines={1}>
            {user?.email ?? ''}
          </Text>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.sectionSub}>Customize who you discover</Text>
      </View>

      <View style={styles.prefsCard}>
        <MultiSelect
          label="Target Industries"
          options={INDUSTRIES}
          selected={prefs.industries}
          onChange={(val) => setPrefs((p) => ({ ...p, industries: val }))}
        />

        <MultiSelect
          label="Sports to prioritize"
          options={SPORTS}
          selected={prefs.sports}
          onChange={(val) => setPrefs((p) => ({ ...p, sports: val }))}
        />

        <MultiSelect
          label="Target Locations"
          options={LOCATIONS}
          selected={prefs.locations}
          onChange={(val) => setPrefs((p) => ({ ...p, locations: val }))}
        />

        <CompanyInput
          companies={prefs.companies ?? []}
          onChange={(val) => setPrefs((p) => ({ ...p, companies: val }))}
        />

        <Text style={msStyles.label}>Priorities</Text>
        <ToggleRow
          label="Same sport"
          sub="Boost alumni from your sport"
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
          sub="More years of experience (10+ yrs out)"
          value={prefs.priorities.seniorAlumni}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, priorities: { ...p.priorities, seniorAlumni: v } }))
          }
          last
        />
      </View>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Preferences'}
        </Text>
      </Pressable>

      {/* About */}
      <View style={styles.aboutCard}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Platform</Text>
          <Text style={styles.aboutValue}>Scout · Cornell Athletics</Text>
        </View>
        <View style={[styles.aboutRow, styles.aboutRowLast]}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
      </View>

      {/* Sign out */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

interface ToggleRowProps {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}

function ToggleRow({ label, sub, value, onChange, last }: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, last && { borderBottomWidth: 0 }]}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  headerWrap: {
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.largeTitle,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    ...typography.headline,
  },
  profileMeta: {
    ...typography.footnote,
    color: colors.red,
    fontWeight: '600',
  },
  profileEmail: {
    ...typography.caption1,
    color: colors.textTertiary,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.title3,
  },
  sectionSub: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: 2,
  },
  prefsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
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
  saveButton: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.headline,
    color: colors.textInverse,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  aboutRowLast: {
    borderBottomWidth: 0,
  },
  aboutLabel: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  aboutValue: {
    ...typography.subhead,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  signOutText: {
    ...typography.subhead,
    color: colors.error,
    fontWeight: '600',
  },
});
