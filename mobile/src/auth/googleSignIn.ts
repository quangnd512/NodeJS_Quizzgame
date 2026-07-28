// Dang nhap Google (native, qua @react-native-google-signin/google-signin) -> lay ID Token cua
// Google -> doi lay Firebase ID Token (qua `signInWithCredential`) -> tra ve cho AuthContext de
// goi tiep `POST /api/auth/login`.
//
// LUU Y QUAN TRONG (xem huong dan trong PENDING/S2.md tu S1):
//   - Thu vien nay la NATIVE MODULE - KHONG chay duoc trong Expo Go, can build dev client
//     (`npx expo prebuild` + `npx expo run:android` / `npx expo run:ios`, hoac EAS Build profile
//     "development"). Day la ly do S1 goi y "SDK phu hop Expo tuy S2 danh gia" - day la lua chon
//     duoc Google/Expo CHINH THUC khuyen nghi (uu tien hon AuthSession chung chung) cho san pham
//     that, du danh doi la khong con dung Expo Go duoc nua SAU KHI da tich hop thu vien nay.
//   - Can cau hinh `webClientId` (BAT BUOC de lay duoc idToken) va `iosClientId` tu Firebase/
//     Google Cloud Console - xem README.md muc "Cau hinh Google Sign-In". Doc tu bien moi truong
//     EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, KHONG hardcode vi day
//     la thong tin rieng cua tung moi truong (dev/prod co the dung OAuth client khac nhau).
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { firebaseAuth } from './firebase';

let isConfigured = false;

/** Dam bao GoogleSignin.configure() chi chay 1 lan (goi lai nhieu lan khong loi nhung khong can thiet). */
function ensureConfigured(): void {
  if (isConfigured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  if (!webClientId) {
    throw new Error(
      '[googleSignIn] Thieu bien moi truong EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. ' +
        'Xem huong dan lay gia tri nay trong mobile/README.md.',
    );
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId,
    offlineAccess: false,
  });
  isConfigured = true;
}

/** Nem ra khi nguoi dung tu huy dang nhap (bam nut "Huy"/dong popup) - KHONG phai loi that su. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Nguoi dung da huy dang nhap Google.');
    this.name = 'GoogleSignInCancelledError';
  }
}

/**
 * Thuc hien toan bo luong dang nhap Google -> tra ve Firebase ID Token (chuoi JWT) de
 * `AuthContext` dung goi `POST /api/auth/login`.
 *
 * @throws GoogleSignInCancelledError neu nguoi dung tu huy
 * @throws Error (cac truong hop khac: thieu Play Services, loi mang, cau hinh sai...)
 */
export async function signInWithGoogle(): Promise<string> {
  ensureConfigured();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // response.type === 'cancelled' - nguoi dung tu dong popup.
      throw new GoogleSignInCancelledError();
    }

    const { idToken } = response.data;
    if (!idToken) {
      throw new Error('[googleSignIn] Google khong tra ve idToken (kiem tra lai cau hinh webClientId).');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(firebaseAuth, credential);
    return await userCredential.user.getIdToken();
  } catch (err) {
    if (err instanceof GoogleSignInCancelledError) throw err;

    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new GoogleSignInCancelledError();
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error('Da co 1 yeu cau dang nhap Google dang xu ly, vui long doi.');
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Thiet bi khong co Google Play Services hoac can cap nhat.');
      }
    }

    throw err;
  }
}
