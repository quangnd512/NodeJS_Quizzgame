// Stack navigator cho tab Thi thu (Exam).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ExamStackParamList } from './types.js';
import { ExamListScreen } from '../screens/exam/ExamListScreen.js';
import { ExamSessionScreen } from '../screens/exam/ExamSessionScreen.js';
import { ExamResultScreen } from '../screens/exam/ExamResultScreen.js';

const Stack = createNativeStackNavigator<ExamStackParamList>();

export function ExamStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExamList" component={ExamListScreen} />
      <Stack.Screen name="ExamSession" component={ExamSessionScreen} />
      <Stack.Screen name="ExamResult" component={ExamResultScreen} />
    </Stack.Navigator>
  );
}
