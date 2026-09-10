// Stack navigator cho tab Ho so — ProfileHome la man hinh chinh, cac man hinh con
// (Notifications, WrongAnswers, Submissions, Battle) duoc push tu day.
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationScreen } from '../screens/NotificationScreen';
import { WrongAnswersScreen } from '../screens/WrongAnswersScreen';
import { SubmissionsScreen } from '../screens/SubmissionsScreen';
import { BattleStackNavigator } from './BattleStackNavigator';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Wrapper component de truyen `onBack` vao NotificationScreen/WrongAnswersScreen/SubmissionsScreen.
// Cac man hinh nay nhan `onBack` thay vi dung hook de co the test doc lap.
function NotificationWrapper({ navigation }: { navigation: { goBack: () => void; getParent: () => { navigate: (name: string) => void } | undefined } }) {
  function handleNavigateToTab(tab: string) {
    // NotificationScreen nam trong ProfileStack → can di len BottomTab de navigate sang tab khac
    navigation.getParent()?.navigate(tab);
    navigation.goBack(); // Dong man hinh thong bao de hien tab vua navigate
  }
  return <NotificationScreen onBack={() => navigation.goBack()} onNavigateToTab={handleNavigateToTab} />;
}

function WrongAnswersWrapper({ navigation }: { navigation: { goBack: () => void } }) {
  return <WrongAnswersScreen onBack={() => navigation.goBack()} />;
}

function SubmissionsWrapper({ navigation }: { navigation: { goBack: () => void } }) {
  return <SubmissionsScreen onBack={() => navigation.goBack()} />;
}

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationWrapper} />
      <Stack.Screen name="WrongAnswers" component={WrongAnswersWrapper} />
      <Stack.Screen name="Submissions" component={SubmissionsWrapper} />
      <Stack.Screen name="Battle" component={BattleStackNavigator} />
    </Stack.Navigator>
  );
}
