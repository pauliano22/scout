// Detox E2E test setup — runs once before all specs.
import { device } from 'detox';

beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES', photos: 'YES' },
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});
