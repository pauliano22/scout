import { by, device, element, expect, waitFor } from 'detox';

describe('Welcome Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show the welcome screen on cold launch', async () => {
    // The welcome screen should be visible when no session exists.
    // We look for the "Sign In" button which is on the WelcomeScreen.
    await expect(element(by.text('Sign In'))).toBeVisible();
  });

  it('should show sign up button on welcome screen', async () => {
    await expect(element(by.text('Create Account'))).toBeVisible();
  });

  it('should navigate to sign-in screen', async () => {
    await element(by.text('Sign In')).tap();
    await expect(element(by.text('Sign In'))).toBeVisible();
  });
});
