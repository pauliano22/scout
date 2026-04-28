import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(trimmedEmail, trimmedPassword);
        if (error) {
          Alert.alert('Sign In Failed', error.message ?? 'Invalid email or password.');
        }
      } else {
        const { error } = await signUp(trimmedEmail, trimmedPassword, fullName.trim());
        if (error) {
          Alert.alert('Sign Up Failed', error.message ?? 'Could not create account.');
        } else {
          Alert.alert(
            'Check your email',
            'We sent a confirmation link. You can also log in now if email confirmation is disabled.',
          );
          setMode('login');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Wordmark */}
        <View style={styles.logoSection}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.wordmark}>Scout</Text>
          <Text style={styles.tagline}>Cornell Athlete Alumni Network</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={styles.cardSub}>
            {mode === 'login'
              ? 'Sign in to your Scout account'
              : 'Join the Cornell athlete network'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Smith"
                placeholderTextColor={colors.textDisabled}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@cornell.edu"
              placeholderTextColor={colors.textDisabled}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <Pressable
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Toggle mode */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.toggleLink}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Cornell Athletics · Student-Athlete Platform
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: -1,
  },
  wordmark: {
    ...typography.title1,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  tagline: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  cardTitle: {
    ...typography.title3,
    marginBottom: 4,
  },
  cardSub: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.callout,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  submitButton: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...typography.subhead,
    color: colors.textInverse,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  toggleText: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  toggleLink: {
    ...typography.subhead,
    color: colors.red,
    fontWeight: '600',
  },
  footer: {
    ...typography.caption2,
    color: colors.textDisabled,
    textAlign: 'center',
  },
});
