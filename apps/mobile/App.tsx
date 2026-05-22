import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { PreferencesProvider } from './src/contexts/PreferencesContext';
import TabNavigator from './src/navigation/TabNavigator';
import WelcomeScreen from './src/screens/WelcomeScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import OnboardingIntroScreen from './src/screens/OnboardingIntroScreen';
import OnboardingCompleteScreen from './src/screens/OnboardingCompleteScreen';
import { colors } from './src/theme/scoutTheme';

type AuthScreen = 'welcome' | 'signin' | 'signup';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [showIntro, setShowIntro] = useState(true);
  const [showCompletion, setShowCompletion] = useState(false);
  const [localOnboardingDone, setLocalOnboardingDone] = useState(false);

  // True if DB confirms done (returning user) OR user just finished this session
  const onboardingDone = (profile?.onboarding_completed ?? false) || localOnboardingDone;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  // Not authenticated — show auth flow
  if (!session) {
    if (authScreen === 'signin') {
      return (
        <SignInScreen
          onBack={() => setAuthScreen('welcome')}
          onCreateAccount={() => setAuthScreen('signup')}
        />
      );
    }
    if (authScreen === 'signup') {
      return <SignUpScreen onBack={() => setAuthScreen('welcome')} />;
    }
    return (
      <WelcomeScreen
        onSignIn={() => setAuthScreen('signin')}
        onCreateAccount={() => setAuthScreen('signup')}
      />
    );
  }

  if (showCompletion) {
    return <OnboardingCompleteScreen onEnter={() => setShowCompletion(false)} />;
  }

  // Authenticated but onboarding not done
  if (!onboardingDone) {
    if (showIntro) {
      return <OnboardingIntroScreen onBegin={() => setShowIntro(false)} />;
    }
    return (
      <OnboardingScreen
        onComplete={() => {
          setLocalOnboardingDone(true);
          setShowCompletion(true);
        }}
      />
    );
  }

  // Fully authenticated
  return (
    <PreferencesProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </PreferencesProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
