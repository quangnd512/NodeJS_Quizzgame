// Khung dieu huong chinh cho HOC SINH — Bottom Tab 5 muc.
// Moi tab dung 1 Stack navigator rieng de quan ly lich su man hinh ben trong tab do.
// Tab "Ho so" (ProfileTab) bao gom ca Notifications, Battle PvP, Dong gop cau hoi.
//
// Dung EMOJI lam icon tab thay vi 1 thu vien icon rieng — nhat quan voi phong cach UI da
// dung emoji o nhieu noi khac trong app web (vd danh muc mon hoc).
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../theme/ThemeContext.js';
import { useAuth } from '../auth/AuthContext.js';
import { getUnreadCount } from '../api/notifications.js';
import { PracticeStackNavigator } from './PracticeStackNavigator.js';
import { ExamStackNavigator } from './ExamStackNavigator.js';
import { LeaderboardStackNavigator } from './LeaderboardStackNavigator.js';
import { ProgressStackNavigator } from './ProgressStackNavigator.js';
import { ProfileStackNavigator } from './ProfileStackNavigator.js';
import type { MainTabParamList } from './types.js';

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
  const { sessionToken } = useAuth();
  const unreadCount = useUnreadNotificationCount(sessionToken ?? null);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      })}
    >
      <Tab.Screen
        name="PracticeTab"
        component={PracticeStackNavigator}
        options={{
          tabBarLabel: 'Luyện tập',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>✏️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ExamTab"
        component={ExamStackNavigator}
        options={{
          tabBarLabel: 'Thi thử',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>📝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="LeaderboardTab"
        component={LeaderboardStackNavigator}
        options={{
          tabBarLabel: 'Xếp hạng',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>🏆</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressStackNavigator}
        options={{
          tabBarLabel: 'Tiến độ',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Text style={{ fontSize: size * 0.85, color }}>📊</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Hồ sơ',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View>
              <Text style={{ fontSize: size * 0.85, color }}>👤</Text>
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    backgroundColor: colors.danger,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
