// Khung dieu huong chinh cho HOC SINH - Bottom Tab 5 muc.
// Moi tab (tru "Ho so") duoc thay the bang nested stack navigator chua cac man hinh thuc.
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../theme/ThemeContext';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { PracticeStackNavigator } from './PracticeStackNavigator';
import { ExamStackNavigator } from './ExamStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_CONFIG: Record<keyof MainTabParamList, { label: string; emoji: string }> = {
  Practice: { label: 'Luyện tập', emoji: '✏️' },
  Exam: { label: 'Thi thử', emoji: '📝' },
  Leaderboard: { label: 'Xếp hạng', emoji: '🏆' },
  Progress: { label: 'Tiến độ', emoji: '📊' },
  Profile: { label: 'Hồ sơ', emoji: '👤' },
};

export function MainTabNavigator() {
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name as keyof MainTabParamList];
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabel: config.label,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>{config.emoji}</Text>
          ),
        };
      }}
    >
      <Tab.Screen name="Practice" component={PracticeStackNavigator} />
      <Tab.Screen name="Exam" component={ExamStackNavigator} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
