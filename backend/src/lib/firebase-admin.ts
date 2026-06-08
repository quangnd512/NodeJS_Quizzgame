// Khoi tao Firebase Admin SDK (singleton) - dung de XAC THUC token do client
// gui len (Firebase ID Token lay duoc sau khi user dang nhap o Frontend bang
// Firebase Auth - Google/Email/Phone...).
//
// QUAN TRONG: Firebase Admin SDK can "Service Account" credentials de hoat dong.
// Cach lay: Firebase Console -> Project Settings -> Service accounts ->
// "Generate new private key" -> tai ve file JSON.
//
// Co 2 cach cau hinh (chon 1 trong 2):
//   1) Dat bien moi truong GOOGLE_APPLICATION_CREDENTIALS = duong dan toi file JSON.
//   2) Dat 3 bien rieng le: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
//      FIREBASE_PRIVATE_KEY (lay tu noi dung file JSON service account).
//      Cach nay tien loi khi deploy len cac nen tang khong ho tro upload file
//      (Heroku, Render, Vercel...).
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Loi cau hinh - nem ra khi thieu bien moi truong can thiet de khoi tao Firebase Admin.
 * Tach rieng de de phan biet voi loi xac thuc token (sai/het han...).
 */
export class FirebaseAdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAdminConfigError';
    Object.setPrototypeOf(this, FirebaseAdminConfigError.prototype);
  }
}

/**
 * Khoi tao (hoac tai su dung) Firebase Admin App.
 *
 * Dung "lazy initialization": chi khoi tao khi lan dau can den (vi du khi co
 * request goi den middleware xac thuc), tranh crash app ngay luc khoi dong
 * neu chua cau hinh xong bien moi truong (thuan tien khi dev cac tinh nang khac).
 */
function getOrCreateFirebaseApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Luu y: private key trong bien moi truong thuong chua ky tu xuong dong dang "\n"
  // (chuoi ky tu, khong phai xuong dong that) - can thay the lai thanh xuong dong that.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new FirebaseAdminConfigError(
      'Thieu cau hinh Firebase Admin SDK. Vui long dat day du 3 bien moi truong: ' +
        'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY ' +
        '(xem huong dan trong backend/.env.example).',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let cachedAuth: Auth | undefined;

/**
 * Lay instance `Auth` cua Firebase Admin SDK (dung de goi `verifyIdToken`).
 * Duoc cache lai sau lan khoi tao dau tien.
 */
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    const app = getOrCreateFirebaseApp();
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}
