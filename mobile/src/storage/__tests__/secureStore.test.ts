// Test cho secureStore — noi luu JWT va admin secret, du lieu nhay cam nhat cua app.
import {
  SecureStoreKeys,
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from '../secureStore';

describe('secureStore', () => {
  beforeEach(() => {
    // Don sach bo nho gia lap giua cac test (mock nam trong jest.setup.js)
    const mocked = jest.requireMock('expo-secure-store') as { __resetStore: () => void };
    mocked.__resetStore();
  });

  // Happy path — luu roi doc lai duoc dung gia tri
  it('luu va doc lai dung gia tri da luu', async () => {
    await setSecureItem(SecureStoreKeys.APP_SESSION_TOKEN, 'jwt-abc-123');

    await expect(getSecureItem(SecureStoreKeys.APP_SESSION_TOKEN)).resolves.toBe('jwt-abc-123');
  });

  // Edge case — doc key chua tung luu thi tra ve null, KHONG nem loi
  it('tra ve null khi key chua ton tai', async () => {
    await expect(getSecureItem(SecureStoreKeys.APP_SESSION_TOKEN)).resolves.toBeNull();
  });

  // Happy path — xoa xong thi doc lai ra null (luong dang xuat)
  it('xoa key thi lan doc sau tra ve null', async () => {
    await setSecureItem(SecureStoreKeys.APP_SESSION_TOKEN, 'jwt-can-xoa');
    await deleteSecureItem(SecureStoreKeys.APP_SESSION_TOKEN);

    await expect(getSecureItem(SecureStoreKeys.APP_SESSION_TOKEN)).resolves.toBeNull();
  });

  // Edge case — ghi de len key da co thi lay gia tri moi nhat
  it('ghi de len key da ton tai', async () => {
    await setSecureItem(SecureStoreKeys.APP_SESSION_TOKEN, 'token-cu');
    await setSecureItem(SecureStoreKeys.APP_SESSION_TOKEN, 'token-moi');

    await expect(getSecureItem(SecureStoreKeys.APP_SESSION_TOKEN)).resolves.toBe('token-moi');
  });

  // Edge case — xoa key chua ton tai thi khong nem loi
  it('xoa key chua ton tai van chay binh thuong', async () => {
    await expect(deleteSecureItem(SecureStoreKeys.APP_SESSION_TOKEN)).resolves.toBeUndefined();
  });
});
