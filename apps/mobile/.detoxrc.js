module.exports = {
  preset: 'detox-kit/expo',
  artifacts: {
    path: '.detox-artifacts',
  },
  behavior: {
    cleanup: {
      exclude: [],
    },
  },
  configurations: {
    'ios.sim.debug': {
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Scout.app',
      build: 'npx expo run:ios --configuration Debug',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
    'ios.sim.release': {
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Scout.app',
      build: 'npx expo run:ios --configuration Release',
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15',
      },
    },
    'android.emu.debug': {
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'npx expo run:android --variant Debug',
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_34',
      },
    },
    'android.emu.release': {
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'npx expo run:android --variant Release',
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_34',
      },
    },
  },
  logger: {
    level: 'info',
  },
  testRunner: {
    args: {
      $0: 'jest',
      config: './e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  specs: './e2e/',
  expo: {
    scheme: 'scout',
  },
};
