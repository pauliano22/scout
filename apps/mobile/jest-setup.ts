// Jest setup for Expo / React Native tests.

// Mock AsyncStorage — heavily used by dailyLimit and other services.
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock expo-status-bar (native module).
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

// Mock react-native-gesture-handler (native module).
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    Swipeable: View,
    TouchableOpacity: 'TouchableOpacity',
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    LongPressGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    FlingGestureHandler: View,
    HandlerStateChangeEvent: {},
    gestureHandlerRootHOC: (Component: any) => Component,
    Directions: {},
    default: {},
  };
});

// Mock expo-image (native module).
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return {
    Image: View,
    ImageBackground: View,
  };
});

// We no longer silence NativeAnimatedHelper since this RN version
// does not expose that internal path under jest-expo.

