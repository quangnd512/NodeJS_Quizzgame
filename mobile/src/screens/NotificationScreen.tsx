// Man hinh Thong bao — danh sach thong bao + danh dau da doc.
// Badge so chua doc hien tren ProfileScreen.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notifications';
import type { NotificationItem } from '../api/notifications';

const TYPE_ICON: Record<string, string> = {
  STREAK_MILESTONE: '🔥',
  RANK_UP: '📈',
  RANK_DOWN: '📉',
  REPORT_RESOLVED: '✅',
  NEW_EXAM_PAPER: '📝',
};

interface Props {
  onBack: () => void;
}

export function NotificationScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    getNotifications(sessionToken, 1, 50)
      .then((res) => {
        setItems(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [sessionToken]);

  async function handleMarkRead(id: string) {
    if (!sessionToken) return;
    try {
      await markNotificationAsRead(sessionToken, id);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // im lang neu loi
    }
  }

  async function handleMarkAll() {
    if (!sessionToken) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead(sessionToken);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // im lang neu loi
    } finally {
      setMarkingAll(false);
    }
  }

  function renderItem({ item }: { item: NotificationItem }) {
    const isUnread = !item.isRead;
    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          {
            backgroundColor: isUnread ? colors.primary + '10' : colors.surface,
            borderColor: isUnread ? colors.primary + '40' : colors.border,
          },
        ]}
        onPress={() => { if (isUnread) void handleMarkRead(item.id); }}
        activeOpacity={0.85}
      >
        <View style={styles.notifIcon}>
          <Text style={{ fontSize: 24 }}>{TYPE_ICON[item.type] ?? '🔔'}</Text>
          {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.notifBody, { color: colors.textMuted }]} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={[styles.notifTime, { color: colors.textMuted }]}>
            {new Date(item.createdAt).toLocaleDateString('vi-VN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          🔔 Thông báo {unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ''}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={() => { void handleMarkAll(); }} disabled={markingAll}>
            {markingAll ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.markAllBtn, { color: colors.primary }]}>Đọc hết</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔕</Text>
          <Text style={[{ color: colors.textMuted, fontSize: 15 }]}>Chưa có thông báo nào</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  markAllBtn: { fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, gap: 10 },
  notifItem: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  notifIcon: { alignItems: 'center', width: 36 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  notifContent: { flex: 1, gap: 4 },
  notifTitle: { fontSize: 14, fontWeight: '700' },
  notifBody: { fontSize: 13, lineHeight: 19 },
  notifTime: { fontSize: 11, marginTop: 2 },
});
