/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-screens|react-native-gesture-handler|@react-native-async-storage/async-storage|@react-native-cookies/cookies|@supabase/supabase-js|supabase|react-native-url-polyfill))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@scout/shared/(.*)$': '<rootDir>/../../packages/shared/$1',
  },
  setupFiles: ['./jest-setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
