// Diem vao UI cua app - chi lam nhiem vu "lap rap" cac Provider theo dung thu tu can thiet.
// Thu tu QUAN TRONG:
//   1. GestureHandlerRootView + SafeAreaProvider - phai o NGOAI CUNG (yeu cau cua
//      react-navigation/react-native-gesture-handler).
//   2. ThemeProvider - phai o TRUOC AuthProvider/AdminAuthProvider vi cac man hinh Dang nhap can
//      doc mau ngay tu dau (kho de tach thu tu nguoc lai vi Provider con khong the doc Context cha
//      chua duoc mount).
//   3. AuthProvider + AdminAuthProvider - doc lap voi nhau (khong long nhau), RootNavigator se doc
//      CA HAI de quyet dinh hien man hinh gi (xem giai thich chi tiet trong RootNavigator.tsx).
//   4. NetworkBanner dat NGOAI RootNavigator (o cap App) de LUON hien thi de trong khi mat mang,
//      bat ke dang o man hinh nao (Dang nhap, Onboarding, khung chinh...).
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/auth/AuthContext';
import { AdminAuthProvider } from './src/admin/AdminAuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NetworkBanner } from './src/network/NetworkBanner';
// Import de dam bao Firebase duoc khoi tao SOM (module co side-effect `initializeApp`) truoc khi
// bat ky man hinh nao co the goi den `firebaseAuth`.
import './src/auth/firebase';

function AppShell() {
  const { scheme } = useAppTheme();
  return (
    <>
      <NetworkBanner />
      <RootNavigator />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <AppShell />
            </AdminAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
