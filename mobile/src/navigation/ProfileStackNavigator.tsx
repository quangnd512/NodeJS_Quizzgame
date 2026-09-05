// Stack navigator cho tab Ho so (Profile) — gom ca Notifications, Dong gop cau hoi, Battle.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { QuestionSubmissionListScreen } from '../screens/questionSubmission/QuestionSubmissionListScreen';
import { QuestionSubmissionFormScreen } from '../screens/questionSubmission/QuestionSubmissionFormScreen';
import { BattleLobbyScreen } from '../screens/battle/BattleLobbyScreen';
import { BattleSessionScreen } from '../screens/battle/BattleSessionScreen';
import { BattleResultScreen } from '../screens/battle/BattleResultScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="QuestionSubmissionList" component={QuestionSubmissionListScreen} />
      <Stack.Screen name="QuestionSubmissionForm" component={QuestionSubmissionFormScreen} />
      <Stack.Screen name="BattleLobby" component={BattleLobbyScreen} />
      <Stack.Screen name="BattleSession" component={BattleSessionScreen} />
      <Stack.Screen name="BattleResult" component={BattleResultScreen} />
    </Stack.Navigator>
  );
}
