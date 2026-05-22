import AsyncStorage from '@react-native-async-storage/async-storage';

export const DAILY_LIMIT = 20;

// Local midnight boundary so the reset feels natural to the user.
// toISOString() is UTC — using getFullYear/Month/Date gives the local date.
// Scoped by userId so the count is per-account, not shared across accounts on
// the same device (e.g. after signing out and creating a new account).
function dayKey(userId: string): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `scout:interactions:${userId}:${y}-${m}-${day}`;
}

export async function getDailySwipeCount(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(dayKey(userId));
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

// Increments today's counter and returns the new total.
export async function incrementSwipeCount(userId: string): Promise<number> {
  try {
    const key = dayKey(userId);
    const raw = await AsyncStorage.getItem(key);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(key, String(next));
    return next;
  } catch {
    // Fail open — don't block the user if storage is unavailable.
    return 0;
  }
}

// Refunds one swipe (used by rewind) and returns the new total.
export async function decrementSwipeCount(userId: string): Promise<number> {
  try {
    const key = dayKey(userId);
    const raw = await AsyncStorage.getItem(key);
    const next = Math.max(0, (raw ? parseInt(raw, 10) : 0) - 1);
    await AsyncStorage.setItem(key, String(next));
    return next;
  } catch {
    return 0;
  }
}
