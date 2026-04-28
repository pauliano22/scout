import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme/scoutTheme';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
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
