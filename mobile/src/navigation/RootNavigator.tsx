// Diem quyet dinh TRUNG TAM: dua vao trang thai cua AuthContext (hoc sinh) VA AdminAuthContext
// (quan tri) de chon 1 trong 4 "the gioi" hien thi - khong bao gio hien thi lan 2 cai cung luc:
//
//   1. Dang boot (1 trong 2 Context van dang doc SecureStore)      -> SplashScreen
//   2. Da dang nhap ADMIN thanh cong                                -> AdminStackNavigator
//      (uu tien kiem tra Admin TRUOC hoc sinh - xem giai thich ben duoi)
//   3. Chua dang nhap hoc sinh (hoac token cu het han)              -> AuthStackNavigator (co loi vao AdminLogin)
//   4. Da dang nhap hoc sinh nhung CHUA chon mon (status=onboarding)-> OnboardingSubjectsScreen
//   5. Da dang nhap hoc sinh DAY DU (status=signedIn)               -> MainTabNavigator
//
// VI SAO UU TIEN ADMIN: ve ly thuyet 1 thiet bi hiem khi dang nhap CA HAI vai tro cung luc (Admin
// thuong dung thiet bi/tai khoan rieng), nhung neu xay ra, uu tien Admin AN TOAN HON (Admin thay
// man hinh hoc sinh trong khi van dang nhap Admin la vo hai - nguoc lai neu 1 thiet bi dung chung
// (vd may demo) lo hien nham khung Admin cho nguoi khong phai admin la rui ro bao mat).
import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { useAdminAuth } from '../admin/AdminAuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingSubjectsScreen } from '../screens/OnboardingSubjectsScreen';
import { AuthStackNavigator } from './AuthStackNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { AdminStackNavigator } from './AdminStackNavigator';

export function RootNavigator() {
  const { status: authStatus } = useAuth();
  const { status: adminStatus } = useAdminAuth();
  const { scheme, colors } = useAppTheme();

  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  let content: React.ReactNode;
  if (authStatus === 'booting' || adminStatus === 'booting') {
    content = <SplashScreen />;
  } else if (adminStatus === 'signedIn') {
    content = <AdminStackNavigator />;
  } else if (authStatus === 'signedOut') {
    content = <AuthStackNavigator />;
  } else if (authStatus === 'onboarding') {
    content = <OnboardingSubjectsScreen />;
  } else {
    content = <MainTabNavigator />;
  }

  return <NavigationContainer theme={navigationTheme}>{content}</NavigationContainer>;
}
