// Dang nhap Apple (qua expo-apple-authentication) -> lay Firebase ID Token -> tra ve cho
// AuthContext de goi tiep POST /api/auth/login. CHI hoat dong tren iOS (xem `isAppleSignInAvailable`).
//
// CO CHE NONCE (chong tan cong replay - BAT BUOC theo khuyen nghi chinh thuc cua Apple/Firebase):
//   1. Tao 1 chuoi ngau nhien "rawNonce".
//   2. Bam SHA-256 "rawNonce" -> "hashedNonce", GUI hashedNonce cho Apple (Apple se nhung no vao
//      trong `identityToken` tra ve, KHONG the lam gia).
//   3. Khi doi credential voi Firebase, gui lai "rawNonce" (BAN GOC, CHUA bam) kem `identityToken` -
//      Firebase tu bam lai va doi chieu voi gia tri Apple da nhung, xac nhan request nay dung la
//      cua chinh thiet bi vua goi Apple (khong phai token bi danh cap/phat lai tu noi khac).
//
// LUU Y: giong Google Sign-In (googleSignIn.ts), day cung la native module - can dev build, KHONG
// chay trong Expo Go. Ngoai ra can tai khoan Apple Developer Program de TEST THAT tren thiet bi/
// gia lap iOS that (xem README.md) - neu chua co, nut nay se hien thi nhung khong the dang nhap
// thanh cong tren iOS that (van bam duoc, Apple se bao loi cau hinh - KHONG crash app).
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth } from './firebase';

/** Nut "Dang nhap bang Apple" CHI duoc hien tren iOS - Android/web khong co Sign in with Apple. */
export const isAppleSignInPlatform = Platform.OS === 'ios';

/** Kiem tra thiet bi HIEN TAI co ho tro Sign in with Apple hay khong (iOS 13+, khong phai iPad cu...). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!isAppleSignInPlatform) return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Nem ra khi nguoi dung tu huy dang nhap. */
export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Nguoi dung da huy dang nhap Apple.');
    this.name = 'AppleSignInCancelledError';
  }
}

/** Tao 1 chuoi ngau nhien du dai (hex, 32 byte = 64 ky tu) dung lam "rawNonce". */
async function generateRawNonce(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Thuc hien toan bo luong dang nhap Apple -> tra ve Firebase ID Token de goi POST /api/auth/login.
 *
 * QUAN TRONG: `fullName` (ho ten) CHI duoc Apple tra ve trong LAN DAU TIEN nguoi dung dong y chia
 * se voi app nay - cac lan dang nhap SAU se la `null`. Ham nay tra ca `fullName` (neu co) de
 * AuthContext co the GUI KEM luc goi /api/auth/login... nhung LUU Y: backend hien tai (`POST
 * /api/auth/login`) CHI doc `displayName` tu chinh Firebase ID Token (do Firebase tu dong gan khi
 * co du lieu), KHONG nhan them field rieng - vi vay ham nay hien CHUA can truyen fullName xuong
 * backend (Firebase se tu dong xu ly khi lan dau lien ket credential co kem tuy chon hien thi ten).
 * Van tra ve de UI co the hien thi tam "Chao <ten>" ngay sau khi dang nhap lan dau neu muon dung
 * o cac dot sau, tranh phai sua lai kien truc ham nay.
 */
export async function signInWithApple(): Promise<{
  firebaseIdToken: string;
  fullName: { givenName: string | null; familyName: string | null } | null;
}> {
  const rawNonce = await generateRawNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    // Ma loi 'ERR_REQUEST_CANCELED' - nguoi dung tu bam Huy tren popup he thong cua Apple.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelledError();
    }
    throw err;
  }

  if (!appleCredential.identityToken) {
    throw new Error('[appleSignIn] Apple khong tra ve identityToken.');
  }

  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });

  const userCredential = await signInWithCredential(firebaseAuth, firebaseCredential);
  const firebaseIdToken = await userCredential.user.getIdToken();

  return {
    firebaseIdToken,
    fullName: appleCredential.fullName
      ? {
          givenName: appleCredential.fullName.givenName,
          familyName: appleCredential.fullName.familyName,
        }
      : null,
  };
}
