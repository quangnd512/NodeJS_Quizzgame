// Man hinh danh sach thong bao — hien thi thong bao + danh dau da doc.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import {
  listNotifications,
  markAllAsRead,
  type NotificationItem,
} from '../../api/notifications.js';
import type { ProfileStackScreenProps } from '../../navigation/types.js';

type Props = ProfileStackScreenProps<'Notifications'>;

const TYPE_ICON: Record<string, string> = {
  STREAK_MILESTONE: '🔥',
  RANK_UP: '⬆️',
  RANK_DOWN: '⬇️',
  REPORT_RESOLVED: '✅',
  NEW_EXAM_PAPER: '📝',
  SUBMISSION_APPROVED: '🎉',
  SUBMISSION_REJECTED: '❌',
  SUBMISSION_USED: '💰',
  PREMIUM_GRANTED: '💎',
  PREMIUM_EXPIRING_SOON: '⚠️',
};

export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await listNotifications(sessionToken);
      setNotifications(res.notifications);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAll = async () => {
    if (!sessionToken || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllAsRead(sessionToken);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: colors.text }]}>Thông báo</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll} disabled={markingAll}>
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.markAll, { color: colors.primary }]}>Đọc tất cả</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có thông báo nào.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const icon = TYPE_ICON[item.type] ?? '📣';
            return (
              <View
                style={[
                  styles.notiCard,
                  {
                    backgroundColor: item.isRead ? colors.surface : (colors.primary + '12'),
                    borderColor: item.isRead ? colors.border : (colors.primary + '40'),
                  },
                ]}
              >
                <Text style={styles.notiIcon}>{icon}</Text>
                <View style={styles.notiBody}>
                  <Text style={[styles.notiTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.notiBody2, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.body}
                  </Text>
                  <Text style={[styles.notiTime, { color: colors.textMuted }]}>
                    {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
                {!item.isRead && (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backText: { fontSize: 20 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 18, fontWeight: '800' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAll: { fontSize: 13, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14 },
  list: { padding: 12, gap: 8 },
  notiCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  notiIcon: { fontSize: 22, marginTop: 2 },
  notiBody: { flex: 1, gap: 3 },
  notiTitle: { fontSize: 14, fontWeight: '700' },
  notiBody2: { fontSize: 13, lineHeight: 18 },
  notiTime: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
