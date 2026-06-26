/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testMatch: ['<rootDir>/e2e/**/*.test.ts?(x)'],
  testTimeout: 120000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-screens|react-native-gesture-handler|@react-native-async-storage/async-storage|@react-native-cookies/cookies|@supabase/supabase-js|supabase|react-native-url-polyfill))',
  ],
  setupFiles: ['<rootDir>/e2e/setup.ts'],
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
