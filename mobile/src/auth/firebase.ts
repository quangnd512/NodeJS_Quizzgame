// Cau hinh Firebase cho Mobile (Firebase JS SDK - `firebase/auth`).
//
// Dung CUNG 1 du an Firebase voi web (frontend/src/lib/firebase.ts) - cac gia tri ben duoi
// KHONG nhay cam (public API key, an toan de commit len Git - khac Service Account JSON dung o
// backend). Neu can tao them 1 project Firebase rieng cho mobile trong tuong lai, chi can doi
// cac gia tri nay.
//
// QUAN TRONG ve "persistence" (Firebase co TU DUNG LUU lai phien dang nhap giua cac lan mo app
// hay khong): ta CHU Y CHON `inMemoryPersistence` (khong luu gi ca) vi Firebase Auth CHI duoc dung
// nhu 1 "buoc trung gian" luc dang nhap (Google/Apple -> lay Firebase ID Token -> doi lay JWT noi
// bo cua he thong qua POST /api/auth/login). SAU do, TOAN BO app dung JWT noi bo (luu trong
// SecureStore, xem `storage/secureStore.ts`) - KHONG can Firebase "nho" ai dang dang nhap giua cac
// lan mo app. Nho vay, ta KHONG can them thu vien AsyncStorage chi de phuc vu Firebase persistence
// (tranh 1 lop luu tru nhay cam thu 2 ngoai SecureStore, dung dung 1 co che luu phien duy nhat).
import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB9OX7oVomjc_WFt0ymyJrgroOGMYUaYyc',
  authDomain: 'quizzgamedh.firebaseapp.com',
  projectId: 'quizzgamedh',
  storageBucket: 'quizzgamedh.firebasestorage.app',
  messagingSenderId: '138173632959',
  appId: '1:138173632959:web:ce9a1a4a1ba018b771910a',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Ap dung inMemoryPersistence ngay khi module duoc import - bo qua loi (hiem khi xay ra) de
// khong lam crash app luc khoi dong; neu that bai, Firebase se dung persistence mac dinh cua nen
// tang (van hoat dong dung, chi khac o cho co the "nho" phien lau hon can thiet - khong anh huong
// bao mat vi ta van luon lay JWT rieng ngay sau khi dang nhap).
setPersistence(firebaseAuth, inMemoryPersistence).catch((err) => {
  console.warn('[firebase] Khong the dat inMemoryPersistence (bo qua, khong anh huong luong chinh):', err);
});
