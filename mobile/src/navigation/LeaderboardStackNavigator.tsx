// Stack navigator cho tab Xep hang (Leaderboard).
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LeaderboardStackParamList } from './types';
import { LeaderboardScreen } from '../screens/leaderboard/LeaderboardScreen';

const Stack = createNativeStackNavigator<LeaderboardStackParamList>();

export function LeaderboardStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeaderboardHome" component={LeaderboardScreen} />
    </Stack.Navigator>
  );
}
