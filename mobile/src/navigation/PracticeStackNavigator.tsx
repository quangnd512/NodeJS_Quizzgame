// Stack navigator cho tab Luyen tap (Practice).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PracticeStackParamList } from './types.js';
import { PracticeHomeScreen } from '../screens/practice/PracticeHomeScreen.js';
import { PracticeSessionScreen } from '../screens/practice/PracticeSessionScreen.js';
import { PracticeResultScreen } from '../screens/practice/PracticeResultScreen.js';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export function PracticeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PracticeHome" component={PracticeHomeScreen} />
      <Stack.Screen name="PracticeSession" component={PracticeSessionScreen} />
      <Stack.Screen name="PracticeResult" component={PracticeResultScreen} />
    </Stack.Navigator>
  );
}
