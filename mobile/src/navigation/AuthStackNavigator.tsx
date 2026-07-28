// Stack hien khi AuthContext.status === 'signedOut' - man Dang nhap hoc sinh + loi vao Dang nhap
// Admin (TASK 9: "tach biet hoan toan khoi luong hoc sinh" - AdminLogin CHI la 1 "cua ngo" nam
// trong stack nay, sau khi dang nhap Admin thanh cong, RootNavigator se chuyen HAN sang
// AdminStackNavigator rieng, KHONG con quay lai duoc cac man hinh hoc sinh o duoi).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { AdminLoginScreen } from '../admin/AdminLoginScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="AdminLogin"
        component={AdminLoginScreen}
        options={{ headerShown: true, title: 'Đăng nhập Quản trị viên' }}
      />
    </Stack.Navigator>
  );
}
