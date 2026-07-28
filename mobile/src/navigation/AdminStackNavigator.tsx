// Khung dieu huong rieng cho Admin (TASK 9) - hoan toan tach biet voi MainTabNavigator cua hoc
// sinh (khac Navigator, khac man hinh, khac Context xac thuc). Dot nay chi co 1 man hinh
// placeholder; cac man quan tri thuc te (quan ly nguoi dung, cau hoi, de thi...) se duoc gan dan
// vao day o cac dot sau, tuong tu cach MainTabNavigator gan dan noi dung cho tung tab hoc sinh.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminHomeScreen } from '../admin/AdminHomeScreen';
import type { AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
    </Stack.Navigator>
  );
}
