// Stack navigator cho tab Thi thu (Exam).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ExamStackParamList } from './types';
import { ExamListScreen } from '../screens/exam/ExamListScreen';
import { ExamSessionScreen } from '../screens/exam/ExamSessionScreen';
import { ExamResultScreen } from '../screens/exam/ExamResultScreen';

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
