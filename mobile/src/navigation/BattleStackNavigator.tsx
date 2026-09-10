// Stack navigator cho luong Thi dau doi khang: BattleHome → BattleResult.
// Truy cap tu ProfileScreen (khong phai 1 trong 5 tab chinh).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BattleScreen } from '../screens/battle/BattleScreen';
import { BattleResultScreen } from '../screens/battle/BattleResultScreen';
import { BattleHistoryScreen } from '../screens/battle/BattleHistoryScreen';
import type { BattleStackParamList } from './types';

const Stack = createNativeStackNavigator<BattleStackParamList>();

export function BattleStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BattleHome" component={BattleScreen} />
      <Stack.Screen name="BattleResult" component={BattleResultScreen} />
      <Stack.Screen name="BattleHistory" component={BattleHistoryScreen} />
    </Stack.Navigator>
  );
}
