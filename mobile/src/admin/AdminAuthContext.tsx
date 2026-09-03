// Context quan ly dang nhap ADMIN - TACH BIET HOAN TOAN voi AuthContext (luong hoc sinh).
// Khong dung Firebase/JWT - chi 1 chuoi "X-Admin-Secret" duy nhat (xem
// backend/src/middleware/admin.middleware.ts). Luu trong SecureStore (khac web dung
// sessionStorage - web mat secret khi dong tab la CHAP NHAN DUOC, nhung mobile can "nho" qua cac
// lan tat/mo app, nen bat buoc phai dung noi luu tru ben vung + ma hoa).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { verifyAdminSecret } from '../api/admin';
import { setAdminUnauthorizedListener } from '../api/client';
import { deleteSecureItem, getSecureItem, setSecureItem, SecureStoreKeys } from '../storage/secureStore';

export type AdminAuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AdminAuthContextValue {
  status: AdminAuthStatus;
  adminSecret: string | null;
  lastError: string | null;
  /** @throws neu secret sai - man hinh dang nhap tu bat loi nay de hien thong bao. */
  signIn: (secret: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AdminAuthStatus>('booting');
  const [adminSecret, setAdminSecret] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const secretRef = useRef<string | null>(null);

  const clearError = useCallback(() => setLastError(null), []);

  const forceSignOut = useCallback(async () => {
    secretRef.current = null;
    await deleteSecureItem(SecureStoreKeys.ADMIN_SECRET);
    setAdminSecret(null);
    setStatus('signedOut');
  }, []);

  // Boot: doc secret cu (neu co) va xac thuc lai voi backend truoc khi cho vao thang khung admin.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await getSecureItem(SecureStoreKeys.ADMIN_SECRET);
      if (!saved) {
        if (!cancelled) setStatus('signedOut');
        return;
      }

      try {
        await verifyAdminSecret(saved);
        if (cancelled) return;
        secretRef.current = saved;
        setAdminSecret(saved);
        setStatus('signedIn');
      } catch (err) {
        console.warn('[AdminAuthContext] Admin secret cu khong con hop le:', err);
        if (!cancelled) await forceSignOut();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAdminUnauthorizedListener(() => {
      if (!secretRef.current) return;
      forceSignOut().catch((err) => console.error('[AdminAuthContext] Loi khi tu dong dang xuat admin:', err));
    });
    return () => setAdminUnauthorizedListener(null);
  }, [forceSignOut]);

  const signIn = useCallback(async (secret: string) => {
    setLastError(null);
    try {
      await verifyAdminSecret(secret);
      await setSecureItem(SecureStoreKeys.ADMIN_SECRET, secret);
      secretRef.current = secret;
      setAdminSecret(secret);
      setStatus('signedIn');
    } catch (err) {
      const message =
        err instanceof Error && 'code' in err && (err as { code?: string }).code === 'ADMIN_UNAUTHORIZED'
          ? 'Sai X-Admin-Secret. Vui long kiem tra lai.'
          : err instanceof Error
            ? err.message
            : 'Dang nhap Admin that bai.';
      setLastError(message);
      throw err;
    }
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ status, adminSecret, lastError, signIn, signOut: forceSignOut, clearError }),
    [status, adminSecret, lastError, signIn, forceSignOut, clearError],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth() phai duoc goi ben trong <AdminAuthProvider>.');
  return ctx;
}
