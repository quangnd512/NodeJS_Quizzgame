// Dang nhap Google -> lay Firebase ID Token (chuoi JWT) de AuthContext dung goi tiep
// POST /api/auth/login.
//
// HAI DUONG KHAC NHAU theo nen tang (xem ham signInWithGoogle ben duoi):
//   - Android/iOS: dung @react-native-google-signin/google-signin (NATIVE MODULE - khong
//     chay duoc trong Expo Go, can build dev client). Day la lua chon duoc Google/Expo
//     CHINH THUC khuyen nghi cho san pham that (uu tien hon AuthSession chung chung).
//   - Web: thu vien native tren KHONG hoat dong dung (goi hasPlayServices() se bao loi
//     "khong co Google Play Services" mot cach vo nghia, vi Play Services la khai niem
//     cua Android). Web dung thang Firebase Web SDK (`signInWithPopup` + GoogleAuthProvider)
//     - day la duong CHINH THUC cua Firebase cho web, khong can webClientId rieng.
//
// LUU Y CAU HINH (xem README.md muc "Cau hinh Google Sign-In"):
//   - Can `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (BAT BUOC cho Android/iOS de lay duoc idToken)
//     va `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` tu Firebase/Google Cloud Console.
//   - Web KHONG can 2 bien tren - chi can `authDomain` trong firebase.ts (da co san).
import { Platform } from 'react-native';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
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
 * Nhanh WEB: dung Firebase Web SDK truc tiep (signInWithPopup) - KHONG dung
 * @react-native-google-signin/google-signin vi thu vien do la native module,
 * tren web no se bao loi "Play Services" sai ngu canh.
 */
async function signInWithGoogleOnWeb(): Promise<string> {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(firebaseAuth, provider);
    return await userCredential.user.getIdToken();
  } catch (err) {
    // Ma loi cua Firebase Web SDK khi nguoi dung tu dong popup (khac ma loi cua thu vien
    // native @react-native-google-signin dung o nhanh Android/iOS ben duoi).
    const code = err instanceof Object && 'code' in err ? (err as { code: unknown }).code : undefined;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new GoogleSignInCancelledError();
    }
    throw err;
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
  if (Platform.OS === 'web') {
    return signInWithGoogleOnWeb();
  }

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
