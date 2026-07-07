import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDailySwipeCount,
  incrementSwipeCount,
  decrementSwipeCount,
  DAILY_LIMIT,
} from '../../src/services/dailyLimit';

const USER_ID = 'test-user-123';
const MOCK_KEY_PATTERN = /^scout:interactions:test-user-123:\d{4}-\d{2}-\d{2}$/;

describe('dailyLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DAILY_LIMIT', () => {
    it('is 20', () => {
      expect(DAILY_LIMIT).toBe(20);
    });
  });

  describe('getDailySwipeCount', () => {
    it('returns 0 when no count stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const count = await getDailySwipeCount(USER_ID);
      expect(count).toBe(0);
    });

    it('returns the stored count', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('5');
      const count = await getDailySwipeCount(USER_ID);
      expect(count).toBe(5);
    });

    it('returns 0 on AsyncStorage error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));
      const count = await getDailySwipeCount(USER_ID);
      expect(count).toBe(0);
    });

    it('uses the correct key format', async () => {
      await getDailySwipeCount(USER_ID);
      const key = (AsyncStorage.getItem as jest.Mock).mock.calls[0][0];
      expect(key).toMatch(MOCK_KEY_PATTERN);
      expect(key).toContain(USER_ID);
    });
  });

  describe('incrementSwipeCount', () => {
    it('increments from 0 to 1', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const next = await incrementSwipeCount(USER_ID);
      expect(next).toBe(1);
    });

    it('increments from 5 to 6', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('5');
      const next = await incrementSwipeCount(USER_ID);
      expect(next).toBe(6);
    });

    it('stores the incremented value', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('3');
      await incrementSwipeCount(USER_ID);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(MOCK_KEY_PATTERN),
        '4',
      );
    });

    it('returns 0 on storage error (fail open)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));
      const next = await incrementSwipeCount(USER_ID);
      expect(next).toBe(0);
    });
  });

  describe('decrementSwipeCount', () => {
    it('decrements from 5 to 4', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('5');
      const next = await decrementSwipeCount(USER_ID);
      expect(next).toBe(4);
    });

    it('does not go below 0', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('0');
      const next = await decrementSwipeCount(USER_ID);
      expect(next).toBe(0);
    });

    it('returns 0 when no count stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const next = await decrementSwipeCount(USER_ID);
      expect(next).toBe(0);
    });

    it('stores the decremented value', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('3');
      await decrementSwipeCount(USER_ID);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(MOCK_KEY_PATTERN),
        '2',
      );
    });
  });
});
