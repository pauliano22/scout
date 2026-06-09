import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../theme/scoutTheme';
import { supabase } from '../lib/supabase';
import { WEB_API_BASE_URL } from '../lib/api';

// ─── Corpus industries (matches apps/web/lib/campaign/industries.ts) ──────────
const INDUSTRIES = ['Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media'] as const;

const OUTCOMES: { key: string; label: string; hint: string }[] = [
  { key: 'informational_interview', label: 'Informational interviews', hint: 'Learn how alumni broke in' },
  { key: 'referral',               label: 'Referrals',                hint: 'Get introduced for roles' },
  { key: 'mentor_relationship',    label: 'Mentors',                  hint: 'Build lasting relationships' },
];

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 70); // ~10 weeks out
  return d.toISOString().slice(0, 10);
}

interface Coverage {
  tier: 'healthy' | 'moderate' | 'thin';
  effective: number;
  industry: string;
  city: string | null;
  suggestion: string | null;
}

interface Props {
  onComplete?: () => void;
}

export default function GoalSetupScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    } else {
      navigation.goBack();
    }
  }, [onComplete, navigation]);
  const [goalMetric, setGoalMetric] = useState<string>('informational_interview');
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [focus, setFocus] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [goalCount, setGoalCount] = useState<string>('3');
  const [deadline, setDeadline] = useState<string>(defaultDeadline());
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIndustryPicker, setShowIndustryPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(`${WEB_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}`, ...(init?.headers ?? {}) },
    });
  }, []);

  // ── Live coverage probe (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ industry });
        if (city.trim()) q.set('city', city.trim());
        const res = await authedFetch(`/api/campaign/coverage?${q.toString()}`);
        if (res.ok) setCoverage(await res.json());
      } catch {
        // best-effort hint
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [industry, city, authedFetch]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function save() {
    const count = Math.max(1, Math.min(50, Number(goalCount) || 1));
    if (!deadline.trim()) {
      setError('Please enter a deadline date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authedFetch('/api/campaign/goal', {
        method: 'POST',
        body: JSON.stringify({
          goalMetric,
          goalCount: count,
          deadline: deadline.trim(),
          industry,
          focus: focus.trim() || null,
          city: city.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'save failed');
      }
      handleComplete();
    } catch (e) {
      setError('Could not save your goal. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => handleComplete()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <Ionicons name="flag-outline" size={16} color={colors.red} />
          <Text style={styles.badgeText}>Set your campaign</Text>
        </View>

        <Text style={styles.title}>What are you working toward?</Text>
        <Text style={styles.desc}>
          Scout lines up the right alumni and drafts your outreach between logins.
          You approve and send everything — nothing goes out without you.
        </Text>

        {/* ── Goal type ──────────────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>Goal</Text>
        {OUTCOMES.map((o) => (
          <Pressable
            key={o.key}
            style={[styles.optionCard, goalMetric === o.key && styles.optionCardActive]}
            onPress={() => setGoalMetric(o.key)}
          >
            <View style={styles.optionCardContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionCardTitle}>{o.label}</Text>
                <Text style={styles.optionCardHint}>{o.hint}</Text>
              </View>
              {goalMetric === o.key && (
                <Ionicons name="checkmark-circle" size={20} color={colors.red} />
              )}
            </View>
          </Pressable>
        ))}

        {/* ── Industry + focus ─────────────────────────────────────────────── */}
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Field</Text>
            <Pressable
              style={styles.pickerBtn}
              onPress={() => setShowIndustryPicker(!showIndustryPicker)}
            >
              <Text style={styles.pickerBtnText}>{industry}</Text>
              <Ionicons
                name={showIndustryPicker ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textTertiary}
              />
            </Pressable>
            {showIndustryPicker && (
              <View style={styles.pickerDropdown}>
                {INDUSTRIES.map((ind) => (
                  <Pressable
                    key={ind}
                    style={[styles.pickerOption, industry === ind && styles.pickerOptionActive]}
                    onPress={() => { setIndustry(ind); setShowIndustryPicker(false); }}
                  >
                    <Text
                      style={[styles.pickerOptionText, industry === ind && styles.pickerOptionTextActive]}
                    >
                      {ind}
                    </Text>
                    {industry === ind && (
                      <Ionicons name="checkmark" size={16} color={colors.red} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>
              Focus <Text style={{ fontWeight: '400', textTransform: 'none', color: colors.textDisabled }}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={focus}
              onChangeText={setFocus}
              placeholder="e.g. fintech, product"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
        </View>

        {/* ── City ────────────────────────────────────────────────────────── */}
        <Text style={styles.fieldLabel}>
          City <Text style={{ fontWeight: '400', textTransform: 'none', color: colors.textDisabled }}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.textInput}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. New York"
          placeholderTextColor={colors.textDisabled}
        />

        {/* ── Coverage hint ───────────────────────────────────────────────── */}
        {coverage && (
          <View
            style={[
              styles.coverageHint,
              coverage.tier === 'thin'
                ? { backgroundColor: '#FEF9C3', borderColor: '#CA8A04' }
                : { backgroundColor: colors.surfaceMuted, borderColor: colors.borderLight },
            ]}
          >
            {coverage.tier === 'thin' ? (
              <Ionicons name="warning" size={16} color={colors.warning} style={{ marginTop: 1 }} />
            ) : (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
            )}
            <View style={{ flex: 1 }}>
              {coverage.tier === 'thin' ? (
                <Text style={styles.coverageText}>
                  {coverage.suggestion}
                  {coverage.city ? (
                    <Text
                      style={{ color: colors.red, fontWeight: '600', textDecorationLine: 'underline' }}
                      onPress={() => setCity('')}
                    >
                      {' '}Search all cities
                    </Text>
                  ) : null}
                </Text>
              ) : (
                <Text style={[styles.coverageText, { color: colors.textSecondary }]}>
                  ~{coverage.effective} {coverage.industry} alumni{coverage.city ? ` in ${coverage.city}` : ''} — good coverage.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Goal count + deadline ────────────────────────────────────────── */}
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>How many</Text>
            <TextInput
              style={styles.textInput}
              value={goalCount}
              onChangeText={(t) => {
                const n = t.replace(/[^0-9]/g, '');
                setGoalCount(n);
              }}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor={colors.textDisabled}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>By when</Text>
            <TextInput
              style={styles.textInput}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textDisabled}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.saveBtnText}>Start my campaign</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.red,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  desc: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },

  // Field label
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },

  // Goal type options
  optionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderHairline,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  optionCardActive: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  optionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionCardHint: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Two-column layout
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },

  // Industry picker
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  pickerDropdown: {
    marginTop: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: colors.redDim,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerOptionTextActive: {
    fontWeight: '600',
    color: colors.red,
  },

  // Text input
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },

  // Coverage hint
  coverageHint: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  coverageText: {
    fontSize: 13,
    color: '#CA8A04',
    lineHeight: 18,
    flex: 1,
  },

  // Error
  errorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: 12,
  },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textInverse,
  },
});
