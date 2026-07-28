// Khung dieu huong chinh cho HOC SINH - Bottom Tab 5 muc (TASK 8). Moi tab (tru "Ho so") hien
// tam man hinh placeholder "Sap ra mat" - se duoc thay dan o cac dot tiep theo (1b/1c/1d...).
//
// Dung EMOJI lam icon tab thay vi 1 thu vien icon rieng (vd @expo/vector-icons) - giu dung so
// luong dependency toi thieu can thiet cho nen mong nay, van nhat quan voi phong cach UI da dung
// emoji o nhieu noi khac trong app web (vd danh muc mon hoc).
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../theme/ThemeContext';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
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
      <Tab.Screen name="Practice">{() => <ComingSoonScreen emoji="✏️" title="Luyện tập" />}</Tab.Screen>
      <Tab.Screen name="Exam">{() => <ComingSoonScreen emoji="📝" title="Thi thử" />}</Tab.Screen>
      <Tab.Screen name="Leaderboard">{() => <ComingSoonScreen emoji="🏆" title="Xếp hạng" />}</Tab.Screen>
      <Tab.Screen name="Progress">{() => <ComingSoonScreen emoji="📊" title="Tiến độ" />}</Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
