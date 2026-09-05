// Stack navigator cho tab Tien do (Progress) — gom ca On cau sai (Wrong Answer).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProgressStackParamList } from './types';
import { ProgressScreen } from '../screens/progress/ProgressScreen';
import { WrongAnswerListScreen } from '../screens/wrongAnswer/WrongAnswerListScreen';
import { WrongAnswerSessionScreen } from '../screens/wrongAnswer/WrongAnswerSessionScreen';

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
