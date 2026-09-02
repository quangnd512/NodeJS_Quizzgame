// Setup chung cho moi test file cua mobile.
// jest-expo da lo phan lon viec mock native module cua Expo/React Native.

// Mock expo-secure-store — app dung SecureStore de luu JWT (xem src/storage/secureStore.ts).
// Moi truong test khong co Keychain (iOS) / Keystore (Android) that nen phai gia lap
// bang mot Map trong bo nho.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
    // Cho phep test tu don dep giua cac case: xem vi du trong
    // src/storage/__tests__/secureStore.test.ts
    __resetStore: () => store.clear(),
  };
});
