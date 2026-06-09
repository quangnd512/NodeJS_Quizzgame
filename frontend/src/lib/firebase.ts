// Cau hinh Firebase cho Frontend (Web SDK)
//
// Lay gia tri tu: Firebase Console → Project Settings → General →
// "Your apps" → Web app → "SDK setup and configuration" → chon "Config"
//
// ⚠️  TODO: Dien gia tri that vao cac truong ben duoi truoc khi chay.
//     Cac gia tri nay KHONG nhay cam (public key, co the commit len Git).
//     Khac voi Service Account JSON dung cho backend (TUYET DOI KHONG COMMIT).

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// const firebaseConfig = {
//   apiKey: 'TODO_API_KEY',                              // AIzaSy...
//   authDomain: 'TODO_AUTH_DOMAIN',                      // your-project.firebaseapp.com
//   projectId: 'TODO_PROJECT_ID',                        // your-project
//   storageBucket: 'TODO_STORAGE_BUCKET',               // your-project.appspot.com
//   messagingSenderId: 'TODO_MESSAGING_SENDER_ID',      // 1234567890
//   appId: 'TODO_APP_ID',                               // 1:123...:web:abc...
// };
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB9OX7oVomjc_WFt0ymyJrgroOGMYUaYyc",
  authDomain: "quizzgamedh.firebaseapp.com",
  projectId: "quizzgamedh",
  storageBucket: "quizzgamedh.firebasestorage.app",
  messagingSenderId: "138173632959",
  appId: "1:138173632959:web:ce9a1a4a1ba018b771910a",
  measurementId: "G-GX1CJJEWW4"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
