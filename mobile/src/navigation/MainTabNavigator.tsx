// Khung dieu huong chinh cho HOC SINH - Bottom Tab 5 muc.
// Moi tab (tru "Ho so") duoc thay the bang nested stack navigator chua cac man hinh thuc.
import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { getUnreadCount } from '../api/notifications';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { PracticeStackNavigator } from './PracticeStackNavigator';
import { ExamStackNavigator } from './ExamStackNavigator';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import type { MainTabParamList } from './types';

/** Nhãn và icon cho từng tab chính. */
const TAB_CONFIG: Record<keyof MainTabParamList, { label: string; emoji: string }> = {
  Practice: { label: 'Ôn tập', emoji: '✏️' },
  Exam: { label: 'Thi thử', emoji: '📝' },
  Leaderboard: { label: 'Xếp hạng', emoji: '🏆' },
  Progress: { label: 'Tiến độ', emoji: '📊' },
  Profile: { label: 'Hồ sơ', emoji: '👤' },
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Hook lay so thong bao chua doc — poll moi 60 giay de cap nhat badge. */
function useUnreadNotificationCount(token: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const fetch = async () => {
      try {
        const res = await getUnreadCount(token);
        if (!cancelled) setCount(res.count);
      } catch {
        // Khong bao loi — badge chi la tiện ich, khong anh huong den luong chinh.
      }
    };

    fetch();
    const id = setInterval(fetch, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  return count;
}

export function MainTabNavigator() {
  const { colors } = useAppTheme();
  const { sessionToken = null } = useAuth();
  const unreadCount = useUnreadNotificationCount(sessionToken);

  return (
    <Tab.Navigator
      initialRouteName="Profile"
      screenOptions={({ route }) => {
        const config = TAB_CONFIG[route.name as keyof MainTabParamList];
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabel: config.label,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>✏️</Text>
          ),
        };
      }}
    >
      <Tab.Screen name="Practice" component={PracticeStackNavigator} />
      <Tab.Screen name="Exam" component={ExamStackNavigator} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ tabBarBadge: unreadCount > 0 ? unreadCount : undefined }}
      />
    </Tab.Navigator>
  );
}
