// Stack navigator cho tab Thi thu: ExamList → ExamTaking → ExamResult.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExamListScreen } from '../screens/exam/ExamListScreen';
import { ExamTakingScreen } from '../screens/exam/ExamTakingScreen';
import { ExamResultScreen } from '../screens/exam/ExamResultScreen';
import type { ExamStackParamList } from './types';

const Stack = createNativeStackNavigator<ExamStackParamList>();

export function ExamStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExamList" component={ExamListScreen} />
      <Stack.Screen name="ExamTaking" component={ExamTakingScreen} />
      <Stack.Screen name="ExamResult" component={ExamResultScreen} />
    </Stack.Navigator>
  );
}
