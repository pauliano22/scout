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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme/scoutTheme';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/common/Input';
import PressableScale from '../components/common/PressableScale';

interface Props {
  onBack: () => void;
}

export default function SignUpScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreateAccount() {
    if (!fullName.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email.trim(), password.trim(), fullName.trim());
    setLoading(false);

    if (error) {
      Alert.alert('Sign Up Failed', error.message ?? 'Could not create account.');
    }
    // On success, AuthContext session updates → App.tsx routes to OnboardingScreen
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create account.</Text>
          <Text style={styles.subtitle}>Join the athlete alumni network</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Input
            label="Email"
            placeholder="you@cornell.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleCreateAccount}
          />

          <PressableScale
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.textInverse} />
              : <Text style={styles.btnText}>Create Account</Text>
            }
          </PressableScale>
        </View>

        <Text style={styles.legal}>
          By creating an account you confirm you are a current or former student-athlete and agree to our Terms of Service and Privacy Policy.
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    marginLeft: -spacing.xs,
  },
  header: {
    marginBottom: spacing.xxxl,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.callout,
    color: colors.textTertiary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.lg,
    ...shadows.md,
  },
  btn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  legal: {
    ...typography.caption1,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
});
