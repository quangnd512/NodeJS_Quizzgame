// Stack navigator cho tab Tien do (Progress) — gom ca On cau sai (Wrong Answer).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProgressStackParamList } from './types.js';
import { ProgressScreen } from '../screens/progress/ProgressScreen.js';
import { WrongAnswerListScreen } from '../screens/wrongAnswer/WrongAnswerListScreen.js';
import { WrongAnswerSessionScreen } from '../screens/wrongAnswer/WrongAnswerSessionScreen.js';

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export function ProgressStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProgressHome" component={ProgressScreen} />
      <Stack.Screen name="WrongAnswerList" component={WrongAnswerListScreen} />
      <Stack.Screen name="WrongAnswerSession" component={WrongAnswerSessionScreen} />
    </Stack.Navigator>
  );
}
