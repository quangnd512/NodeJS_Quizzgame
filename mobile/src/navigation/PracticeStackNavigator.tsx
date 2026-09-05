// Stack navigator cho tab Luyen tap: PracticeHome → PracticeSession → PracticeResult.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PracticeScreen } from '../screens/practice/PracticeScreen';
import { PracticeSessionScreen } from '../screens/practice/PracticeSessionScreen';
import { PracticeResultScreen } from '../screens/practice/PracticeResultScreen';
import type { PracticeStackParamList } from './types';

const Stack = createNativeStackNavigator<PracticeStackParamList>();

export function PracticeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PracticeHome" component={PracticeScreen} />
      <Stack.Screen name="PracticeSession" component={PracticeSessionScreen} />
      <Stack.Screen name="PracticeResult" component={PracticeResultScreen} />
    </Stack.Navigator>
  );
}
