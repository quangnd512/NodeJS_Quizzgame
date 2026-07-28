// Wrapper mong quanh `expo-secure-store` - noi DUY NHAT trong app duoc phep dung SecureStore truc
// tiep, giup: (1) tap trung danh sach "key" tranh go nham chuoi rai rac nhieu noi, (2) de doi thu
// vien luu tru sau nay neu can ma chi phai sua 1 file.
//
// TAI SAO BAT BUOC dung SecureStore (KHONG dung AsyncStorage thuong):
//   SecureStore luu du lieu vao Keychain (iOS) / Keystore (Android) - CO MA HOA phan cung, khac
//   AsyncStorage chi luu plain text (bat ky ai truy cap duoc file he thong/thiet bi bi root/jailbreak
//   deu doc duoc). JWT noi bo va admin secret la du lieu NHAY CAM (chiem doat duoc = chiem doat tai
//   khoan/quyen admin) nen BAT BUOC theo DoD cua tinh nang nay.
import * as SecureStore from 'expo-secure-store';

/** Liet ke TOAN BO key duoc dung trong SecureStore cua app - tranh xung dot/go nham ten. */
export const SecureStoreKeys = {
  /** JWT noi bo (phat hanh boi POST /api/auth/login), han 7 ngay. */
  APP_SESSION_TOKEN: 'app_session_token',
  /** X-Admin-Secret nguoi dung nhap luc dang nhap Admin. */
  ADMIN_SECRET: 'admin_secret',
  /** Lua chon giao dien: 'light' | 'dark' | 'system'. Khong nhay cam nhung dung chung SecureStore
   *  de khong phai them 1 thu vien luu tru (AsyncStorage) chi cho 1 gia tri duy nhat. */
  THEME_PREFERENCE: 'theme_preference',
} as const;

export type SecureStoreKey = (typeof SecureStoreKeys)[keyof typeof SecureStoreKeys];

/** Doc 1 gia tri - tra ve `null` neu chua tung luu hoac co loi doc (vd thiet bi khong ho tro). */
export async function getSecureItem(key: SecureStoreKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.error(`[secureStore] Loi doc key "${key}":`, err);
    return null;
  }
}

/** Ghi 1 gia tri. */
export async function setSecureItem(key: SecureStoreKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

/** Xoa 1 gia tri (dung khi dang xuat). */
export async function deleteSecureItem(key: SecureStoreKey): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.error(`[secureStore] Loi xoa key "${key}":`, err);
  }
}
