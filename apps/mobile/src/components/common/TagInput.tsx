import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../../theme/scoutTheme';

export interface TagInputProps {
  label: string;
  placeholder: string;
  suggestions?: string[];
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  hint?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export default function TagInput({
  label,
  placeholder,
  suggestions = [],
  tags,
  onAdd,
  onRemove,
  hint,
  autoCapitalize = 'words',
  style,
  compact = false,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [inputVisible, setInputVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const filtered =
    draft.trim().length > 0
      ? suggestions
          .filter(
            (s) =>
              s.toLowerCase().includes(draft.toLowerCase()) && !tags.includes(s),
          )
          .slice(0, 5)
      : [];

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      setOpen(false);
      return;
    }
    onAdd(trimmed);
    setDraft('');
    setOpen(false);
  }

  function openInput() {
    setInputVisible(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleBlur() {
    setOpen(false);
    if (compact) {
      setInputVisible(false);
      setDraft('');
    }
  }

  if (compact) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}

        {/* Chips + ghost add-chip */}
        <View style={styles.chips}>
          {tags.map((tag) => (
            <Pressable key={tag} style={styles.chip} onPress={() => onRemove(tag)}>
              <Text style={styles.chipText}>{tag}</Text>
              <Ionicons name="close" size={13} color={colors.textSecondary} />
            </Pressable>
          ))}
          {!inputVisible && (
            <Pressable style={styles.addChip} onPress={openInput} hitSlop={8}>
              <Ionicons name="add" size={14} color={colors.textTertiary} />
              <Text style={styles.addChipText}>Add</Text>
            </Pressable>
          )}
        </View>

        {/* Inline input — shown after tapping Add */}
        {inputVisible && (
          <View style={{ zIndex: 10, marginTop: spacing.sm }}>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={colors.textDisabled}
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  setOpen(true);
                }}
                autoCapitalize={autoCapitalize}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => add(draft)}
                onBlur={handleBlur}
              />
              <Pressable
                style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
                onPress={() => add(draft)}
                disabled={!draft.trim()}
                hitSlop={8}
              >
                <Ionicons name="add" size={20} color={colors.textInverse} />
              </Pressable>
            </View>

            {open && filtered.length > 0 && (
              <View style={styles.dropdown}>
                {filtered.map((s, i) => (
                  <Pressable
                    key={s}
                    style={[styles.dropRow, i < filtered.length - 1 && styles.dropRowBorder]}
                    onPress={() => add(s)}
                  >
                    <Text style={styles.dropText}>{s}</Text>
                    <Ionicons name="add-circle-outline" size={16} color={colors.textTertiary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // Non-compact (original layout — used by OnboardingScreen)
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View style={{ zIndex: 10 }}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={colors.textDisabled}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => add(draft)}
          />
          <Pressable
            style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
            onPress={() => add(draft)}
            disabled={!draft.trim()}
            hitSlop={8}
          >
            <Ionicons name="add" size={20} color={colors.textInverse} />
          </Pressable>
        </View>

        {open && filtered.length > 0 && (
          <View style={styles.dropdown}>
            {filtered.map((s, i) => (
              <Pressable
                key={s}
                style={[styles.dropRow, i < filtered.length - 1 && styles.dropRowBorder]}
                onPress={() => add(s)}
              >
                <Text style={styles.dropText}>{s}</Text>
                <Ionicons name="add-circle-outline" size={16} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <Pressable key={tag} style={styles.chip} onPress={() => onRemove(tag)}>
              <Text style={styles.chipText}>{tag}</Text>
              <Ionicons name="close" size={13} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.callout,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipText: { ...typography.footnote, color: colors.textPrimary, fontWeight: '500' },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  addChipText: {
    ...typography.footnote,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});
