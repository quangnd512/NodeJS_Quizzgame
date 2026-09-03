// Context Dark Mode (TASK 10): 3 lua chon 'light' | 'dark' | 'system', luu lua chon vao SecureStore
// (khong nhay cam nhung dung chung SecureStore de khong phai them AsyncStorage - xem giai thich
// trong storage/secureStore.ts) - giu nguyen sau khi tat/mo lai app.
//
// 'system' nghia la LUON bam theo cai dat he thong hien tai (`useColorScheme()` cua React Native
// tu dong bao lai moi khi nguoi dung doi Sang/Toi trong Cai dat dien thoai, kha ca luc app dang mo).
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type AppColors } from './colors';
import { getSecureItem, setSecureItem, SecureStoreKeys } from '../storage/secureStore';

export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveScheme = 'light' | 'dark';

interface ThemeContextValue {
  /** Lua chon NGUOI DUNG da chon (co the la 'system'). */
  preference: ThemePreference;
  /** Giao dien THUC TE dang ap dung (da quy doi 'system' -> 'light'|'dark' cu the). */
  scheme: EffectiveScheme;
  colors: AppColors;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null (RN co the tra null luc dau)
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  // Doc lua chon da luu (neu co) luc app khoi dong.
  useEffect(() => {
    (async () => {
      const saved = await getSecureItem(SecureStoreKeys.THEME_PREFERENCE);
      if (isValidPreference(saved)) setPreferenceState(saved);
      setLoaded(true);
    })();
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    setSecureItem(SecureStoreKeys.THEME_PREFERENCE, pref).catch((err) =>
      console.error('[ThemeContext] Khong luu duoc lua chon giao dien:', err),
    );
  };

  const scheme: EffectiveScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, colors, setPreference }),
    [preference, scheme, colors],
  );

  // Tranh nhap nhay giao dien mac dinh -> giao dien da luu trong khoanh khac dau tien app mo -
  // nhung KHONG chan render qua lau (chi cho toi khi doc xong SecureStore, thuong < 50ms).
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme() phai duoc goi ben trong <ThemeProvider>.');
  return ctx;
}
