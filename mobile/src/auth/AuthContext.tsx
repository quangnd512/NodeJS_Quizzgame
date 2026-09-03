// Context quan ly TOAN BO trang thai dang nhap cua LUONG HOC SINH (khac hoan toan voi
// AdminAuthContext - xem `admin/AdminAuthContext.tsx`).
//
// May trang thai (state machine) - dung 'status' de RootNavigator quyet dinh hien man hinh nao:
//   'booting'    - moi mo app, dang doc SecureStore + xac thuc lai token cu (hien SplashScreen).
//   'signedOut'  - chua dang nhap (hoac token cu khong con hop le) -> hien AuthStack (LoginScreen).
//   'onboarding' - da dang nhap nhung CHUA chon mon hoc (subjects rong) -> hien OnboardingScreen.
//   'signedIn'   - da dang nhap DAY DU (co it nhat 1 mon) -> hien MainTabNavigator.
//
// TASK 6 (giu phien dang nhap): dang ky voi `api/client.ts` 1 listener duoc goi TU DONG moi khi
// bat ky request nao dung sessionToken nhan ve 401 (JWT het han/khong hop le) - tu dong xoa token +
// chuyen thang ve 'signedOut', KHONG can tung man hinh tu bat loi 401 rieng le.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { loginWithFirebaseToken } from '../api/auth';
import { getMyProfile, updateSubjects, type SubjectCatalogEntry, type UserMeDto } from '../api/users';
import { signInWithApple } from './appleSignIn';
import { signInWithGoogle } from './googleSignIn';
import { deleteSecureItem, getSecureItem, setSecureItem, SecureStoreKeys } from '../storage/secureStore';
import { setSessionUnauthorizedListener } from '../api/client';

export type AuthStatus = 'booting' | 'signedOut' | 'onboarding' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  /** Chi khac null khi status === 'onboarding' | 'signedIn'. */
  sessionToken: string | null;
  /** Chi khac null khi status === 'onboarding' | 'signedIn'. */
  profile: UserMeDto | null;
  /** Loi hien thi tren LoginScreen (vd huy dang nhap, sai mang...) - tu xoa khi thu lai. */
  lastError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** Onboarding: luu danh sach mon hoc, chuyen status -> 'signedIn' neu thanh cong. */
  completeOnboarding: (subjects: SubjectCatalogEntry[]) => Promise<void>;
  /** Goi lai GET /api/users/me - dung sau khi doi mon/cap nhat ho so o cac man hinh khac. */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserMeDto | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Dung ref de listener 401 (dang ky 1 lan luc mount) luon doc duoc gia tri MOI NHAT, khong bi
  // "dong bang" theo closure cua lan render dau tien.
  const tokenRef = useRef<string | null>(null);

  const clearError = useCallback(() => setLastError(null), []);

  /** Xoa toan bo trang thai + SecureStore, ve 'signedOut'. Dung khi dang xuat THU CONG hoac khi bi 401. */
  const forceSignOut = useCallback(async () => {
    tokenRef.current = null;
    await deleteSecureItem(SecureStoreKeys.APP_SESSION_TOKEN);
    setSessionToken(null);
    setProfile(null);
    setStatus('signedOut');
  }, []);

  /**
   * Sau khi co 1 sessionToken HOP LE (moi dang nhap xong, hoac doc lai luc boot) - goi GET /me,
   * quyet dinh 'onboarding' (subjects rong) hay 'signedIn' (co >= 1 mon). Day la NGUON SU THAT DUY
   * NHAT cho quyet dinh nay (theo dung yeu cau cua S1: dung `subjects.length > 0` tu GET /api/users/me,
   * KHONG dua vao co `isNewUser` tra ve luc dang nhap - vi user co the da tung dang ky qua web).
   */
  const applySessionToken = useCallback(async (token: string) => {
    tokenRef.current = token;
    setSessionToken(token);

    const me = await getMyProfile(token);
    setProfile(me);
    setStatus(me.subjects.length > 0 ? 'signedIn' : 'onboarding');
  }, []);

  // Boot: doc token cu tu SecureStore (neu co) va thu xac thuc lai.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const savedToken = await getSecureItem(SecureStoreKeys.APP_SESSION_TOKEN);
      if (!savedToken) {
        if (!cancelled) setStatus('signedOut');
        return;
      }

      try {
        await applySessionToken(savedToken);
      } catch (err) {
        // Token cu khong con hop le (het han sau 7 ngay, tai khoan bi xoa/khoa...) - ve man Dang nhap,
        // KHONG crash app (dung DoD: "JWT het han/khong hop le -> tu dong dieu huong ve man Dang nhap").
        console.warn('[AuthContext] Token cu khong con hop le, yeu cau dang nhap lai:', err);
        if (!cancelled) await forceSignOut();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dang ky listener 401 MOT LAN duy nhat luc mount - tu dong dang xuat khi JWT khong con hop le
  // trong luc app dang chay (khac voi nhanh boot o tren - nhanh nay xu ly khi dang DUNG app).
  useEffect(() => {
    setSessionUnauthorizedListener(() => {
      if (!tokenRef.current) return; // Da signedOut roi, khong can lam gi them.
      forceSignOut().catch((err) => console.error('[AuthContext] Loi khi tu dong dang xuat:', err));
    });
    return () => setSessionUnauthorizedListener(null);
  }, [forceSignOut]);

  /** Buoc CHUNG sau khi co Firebase ID Token (bat ke tu Google hay Apple): doi JWT + luu SecureStore. */
  const finishLoginWithFirebaseToken = useCallback(
    async (firebaseIdToken: string) => {
      const result = await loginWithFirebaseToken(firebaseIdToken);
      await setSecureItem(SecureStoreKeys.APP_SESSION_TOKEN, result.token);
      await applySessionToken(result.token);
    },
    [applySessionToken],
  );

  const handleSignInWithGoogle = useCallback(async () => {
    setLastError(null);
    try {
      const firebaseIdToken = await signInWithGoogle();
      await finishLoginWithFirebaseToken(firebaseIdToken);
    } catch (err) {
      if (err instanceof Error && err.name === 'GoogleSignInCancelledError') return; // Nguoi dung tu huy - khong hien loi.
      const message = err instanceof Error ? err.message : 'Dang nhap Google that bai.';
      setLastError(message);
      throw err;
    }
  }, [finishLoginWithFirebaseToken]);

  const handleSignInWithApple = useCallback(async () => {
    setLastError(null);
    try {
      const { firebaseIdToken } = await signInWithApple();
      await finishLoginWithFirebaseToken(firebaseIdToken);
    } catch (err) {
      if (err instanceof Error && err.name === 'AppleSignInCancelledError') return;
      const message = err instanceof Error ? err.message : 'Dang nhap Apple that bai.';
      setLastError(message);
      throw err;
    }
  }, [finishLoginWithFirebaseToken]);

  const handleCompleteOnboarding = useCallback(
    async (subjects: SubjectCatalogEntry[]) => {
      if (!tokenRef.current) throw new Error('Chua dang nhap.');
      const result = await updateSubjects(tokenRef.current, subjects);
      setProfile((prev) => (prev ? { ...prev, subjects: result.subjects } : prev));
      setStatus('signedIn');
    },
    [],
  );

  const handleRefreshProfile = useCallback(async () => {
    if (!tokenRef.current) return;
    const me = await getMyProfile(tokenRef.current);
    setProfile(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      sessionToken,
      profile,
      lastError,
      signInWithGoogle: handleSignInWithGoogle,
      signInWithApple: handleSignInWithApple,
      completeOnboarding: handleCompleteOnboarding,
      refreshProfile: handleRefreshProfile,
      signOut: forceSignOut,
      clearError,
    }),
    [
      status,
      sessionToken,
      profile,
      lastError,
      handleSignInWithGoogle,
      handleSignInWithApple,
      handleCompleteOnboarding,
      handleRefreshProfile,
      forceSignOut,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() phai duoc goi ben trong <AuthProvider>.');
  return ctx;
}
