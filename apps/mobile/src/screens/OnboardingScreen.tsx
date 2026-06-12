import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { autostartCampaign } from '../lib/api';
import { saveUserPreferences } from '../services/recommendations';
import { useAuth } from '../contexts/AuthContext';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { INTEREST_SUGGESTIONS } from '@scout/shared/constants/interests';
import PressableScale from '../components/common/PressableScale';

const TOTAL_STEPS = 4;

// Match YouScreen exactly
const SPORTS = [
  'Basketball', 'Soccer', 'Football', 'Lacrosse', 'Tennis', 'Swimming',
  'Baseball', 'Volleyball', 'Hockey', 'Track & Field', 'Rowing', 'Wrestling',
  'Golf', 'Field Hockey', 'Cross Country', 'Fencing', 'Gymnastics',
];
const INDUSTRIES = INTEREST_SUGGESTIONS;
const LOCATIONS = [
  'New York', 'San Francisco', 'Boston', 'Chicago', 'Los Angeles',
  'Washington DC', 'Seattle', 'Austin', 'Houston', 'Miami',
];
const STAGES = [
  { value: 'exploring', label: 'Just exploring', desc: 'Not sure what I want yet' },
  { value: 'recruiting', label: 'Actively recruiting', desc: 'Applying and interviewing' },
  { value: 'interviewing', label: 'Preparing for interviews', desc: 'Have leads, working on next steps' },
  { value: 'referrals', label: 'Looking for referrals', desc: 'Know what I want, need introductions' },
  { value: 'relationship_building', label: 'Long-term networking', desc: 'Building my professional network' },
];

// ─── Single autocomplete (sport) ─────────────────────────────────────────────

interface SingleAutocompleteProps {
  label: string;
  placeholder: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

function SingleAutocomplete({ label, placeholder, options, value, onChange }: SingleAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  function select(option: string) {
    onChange(option);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
  }

  return (
    <View style={acStyles.wrap}>
      <Text style={styles.fieldLabel}>{label}</Text>

      {value ? (
        <View style={acStyles.selectedChip}>
          <Text style={acStyles.selectedChipText}>{value}</Text>
          <Pressable onPress={clear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textInverse} />
          </Pressable>
        </View>
      ) : (
        <View style={{ zIndex: 10 }}>
          <View style={acStyles.inputRow}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={acStyles.searchIcon} />
            <TextInput
              style={acStyles.input}
              placeholder={placeholder}
              placeholderTextColor={colors.textDisabled}
              value={query}
              onChangeText={text => { setQuery(text); setOpen(true); }}
              onFocus={() => setOpen(true)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setOpen(false); }} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {open && filtered.length > 0 && (
            <View style={acStyles.dropdown}>
              {filtered.map((opt, i) => (
                <Pressable
                  key={opt}
                  style={[acStyles.dropRow, i < filtered.length - 1 && acStyles.dropRowBorder]}
                  onPress={() => select(opt)}
                >
                  <Text style={acStyles.dropText}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const acStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.callout,
    color: colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 4,
    ...shadows.md,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  dropRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  dropText: { ...typography.callout, color: colors.textPrimary },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.red,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectedChipText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '600',
  },
});

// ─── Tag input (multi — industries, roles, locations) ─────────────────────────

interface TagInputProps {
  label: string;
  placeholder: string;
  suggestions?: string[];
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  hint?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}

function TagInput({ label, placeholder, suggestions = [], tags, onAdd, onRemove, hint, autoCapitalize = 'words' }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = draft.trim().length > 0
    ? suggestions.filter(s =>
        s.toLowerCase().includes(draft.toLowerCase()) &&
        !tags.includes(s)
      ).slice(0, 5)
    : [];

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      setOpen(false);
      return;
    }
    onAdd(trimmed);
    setDraft('');
    setOpen(false);
  }

  return (
    <View style={tiStyles.wrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={tiStyles.hint}>{hint}</Text> : null}

      <View style={{ zIndex: 10 }}>
        <View style={tiStyles.inputRow}>
          <TextInput
            style={tiStyles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.textDisabled}
            value={draft}
            onChangeText={text => { setDraft(text); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => add(draft)}
          />
          <Pressable
            style={[tiStyles.addBtn, !draft.trim() && tiStyles.addBtnDisabled]}
            onPress={() => add(draft)}
            disabled={!draft.trim()}
          >
            <Ionicons name="add" size={20} color={colors.textInverse} />
          </Pressable>
        </View>

        {open && filtered.length > 0 && (
          <View style={tiStyles.dropdown}>
            {filtered.map((s, i) => (
              <Pressable
                key={s}
                style={[tiStyles.dropRow, i < filtered.length - 1 && tiStyles.dropRowBorder]}
                onPress={() => add(s)}
              >
                <Text style={tiStyles.dropText}>{s}</Text>
                <Ionicons name="add-circle-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {tags.length > 0 && (
        <View style={tiStyles.chips}>
          {tags.map(tag => (
            <Pressable key={tag} style={tiStyles.chip} onPress={() => onRemove(tag)}>
              <Text style={tiStyles.chipText}>{tag}</Text>
              <Ionicons name="close" size={13} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const tiStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  hint: {
    ...typography.caption1,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.callout,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.35 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 4,
    ...shadows.md,
    zIndex: 999,
    overflow: 'hidden',
  },
  dropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dropRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderHairline,
  },
  dropText: { ...typography.callout, color: colors.textPrimary },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  chipText: { ...typography.footnote, color: colors.textPrimary, fontWeight: '500' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step 0 — Background
  const [sport, setSport] = useState('');
  const [gradYear, setGradYear] = useState('');

  // Step 1 — Career
  const [industries, setIndustries] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // Step 2 — Stage
  const [currentStage, setCurrentStage] = useState('exploring');

  // Step 3 — Location
  const [locations, setLocations] = useState<string[]>([]);

  function transition(next: number) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      const year = parseInt(gradYear, 10);
      const validYear = !isNaN(year) && year > 2000 && year < 2100 ? year : null;

      const { error: profileError } = await supabase.from('profiles').update({
        sport: sport || null,
        graduation_year: validYear,
        primary_industry: industries[0] ?? null,
        secondary_industries: industries.slice(1),
        target_roles: roles,
        current_stage: currentStage,
        preferred_locations: locations,
        geography_preference: locations.length > 0 ? 'city' : 'doesnt_matter',
        networking_intensity: 'own_pace',
        onboarding_completed: true,
      }).eq('id', user.id);

      if (profileError) throw profileError;

      // Pre-populate user_preferences so You page is ready
      await saveUserPreferences(user.id, {
        industries,
        sports: sport ? [sport] : [],
        locations,
        roles,
        companies: [],
        priorities: { sameSport: true, similarIndustry: true, seniorAlumni: false },
      });

      // Preferences are saved — start the agentic campaign from them so the
      // student never fills a second goal form. Best-effort: a miss here just
      // means CampaignScreen retries on first open.
      await autostartCampaign();

      await refreshProfile();
      onComplete();
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Nav */}
      <View style={styles.nav}>
        {step > 0 ? (
          <Pressable style={styles.navBtn} onPress={() => transition(step - 1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        ) : <View style={styles.navBtn} />}

        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[
              styles.dot,
              i === step ? styles.dotActive : i < step ? styles.dotDone : styles.dotInactive,
            ]} />
          ))}
        </View>

        <View style={styles.navBtn} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Step 0: Background ──────────────────────────── */}
            {step === 0 && (
              <>
                <Text style={styles.greeting}>Hi {firstName}.</Text>
                <Text style={styles.title}>Your athletic background</Text>
                <Text style={styles.sub}>We'll use this to find alumni who know your world.</Text>

                <SingleAutocomplete
                  label="Sport"
                  placeholder="Search your sport…"
                  options={SPORTS}
                  value={sport}
                  onChange={setSport}
                />

                <View style={acStyles.wrap}>
                  <Text style={styles.fieldLabel}>Graduation Year</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 2027"
                    placeholderTextColor={colors.textDisabled}
                    value={gradYear}
                    onChangeText={setGradYear}
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="done"
                  />
                </View>
              </>
            )}

            {/* ── Step 1: Career ──────────────────────────────── */}
            {step === 1 && (
              <>
                <Text style={styles.title}>Career interests</Text>
                <Text style={styles.sub}>What industries and roles are you exploring?</Text>

                <TagInput
                  label="Target Industries"
                  placeholder="e.g. Finance, Technology…"
                  suggestions={INDUSTRIES}
                  tags={industries}
                  onAdd={t => setIndustries(p => [...p, t])}
                  onRemove={t => setIndustries(p => p.filter(i => i !== t))}
                  hint="First one added becomes your primary industry."
                  autoCapitalize="words"
                />

                <TagInput
                  label="Target Roles"
                  placeholder="e.g. Product Manager, Analyst…"
                  tags={roles}
                  onAdd={t => setRoles(p => [...p, t])}
                  onRemove={t => setRoles(p => p.filter(r => r !== t))}
                  autoCapitalize="words"
                />
              </>
            )}

            {/* ── Step 2: Stage ───────────────────────────────── */}
            {step === 2 && (
              <>
                <Text style={styles.title}>Where are you at?</Text>
                <Text style={styles.sub}>We'll tailor your recommendations to match.</Text>

                <View style={{ gap: spacing.sm }}>
                  {STAGES.map(s => {
                    const active = currentStage === s.value;
                    return (
                      <Pressable
                        key={s.value}
                        style={[styles.stageCard, active && styles.stageCardActive]}
                        onPress={() => setCurrentStage(s.value)}
                      >
                        <View style={[styles.radio, active && styles.radioActive]}>
                          {active && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>
                            {s.label}
                          </Text>
                          <Text style={styles.stageDesc}>{s.desc}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Step 3: Location ────────────────────────────── */}
            {step === 3 && (
              <>
                <Text style={styles.title}>Where do you want to work?</Text>
                <Text style={styles.sub}>We'll surface alumni in your target markets.</Text>

                <TagInput
                  label="Target Locations"
                  placeholder="e.g. New York, San Francisco…"
                  suggestions={LOCATIONS}
                  tags={locations}
                  onAdd={t => setLocations(p => [...p, t])}
                  onRemove={t => setLocations(p => p.filter(l => l !== t))}
                  autoCapitalize="words"
                />
              </>
            )}

          </ScrollView>
        </Animated.View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <PressableScale
            style={[styles.continueBtn, submitting && { opacity: 0.8 }]}
            onPress={() => isLastStep ? handleSubmit() : transition(step + 1)}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.textInverse} />
              : (
                <View style={styles.continueBtnInner}>
                  <Text style={styles.continueBtnText}>
                    {isLastStep ? 'Finish Setup' : 'Continue'}
                  </Text>
                  {!isLastStep && <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />}
                </View>
              )
            }
          </PressableScale>
          {!isLastStep && (
            <Pressable onPress={() => transition(step + 1)} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: colors.red },
  dotDone: { width: 6, backgroundColor: colors.red, opacity: 0.3 },
  dotInactive: { width: 6, backgroundColor: colors.border },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  greeting: { fontSize: 17, fontWeight: '600', color: colors.red, marginBottom: spacing.xs },
  title: { fontSize: 30, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: spacing.sm },
  sub: { ...typography.callout, color: colors.textTertiary, lineHeight: 22, marginBottom: spacing.xxxl },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.callout,
    color: colors.textPrimary,
  },

  // Stage cards
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stageCardActive: { borderColor: colors.red, backgroundColor: colors.redDim },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.red },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  stageLabel: { ...typography.headline, color: colors.textPrimary, marginBottom: 2 },
  stageLabelActive: { color: colors.red },
  stageDesc: { ...typography.footnote, color: colors.textTertiary },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderHairline,
    gap: spacing.sm,
  },
  continueBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.sm,
  },
  continueBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  continueBtnText: { fontSize: 17, fontWeight: '600', color: colors.textInverse, letterSpacing: -0.2 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { ...typography.subhead, color: colors.textTertiary },
});
