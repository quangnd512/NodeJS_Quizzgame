// Man hinh Lich su bai thi da nop — danh sach tat ca bai thi nguoi dung da thi.
// Premium gate: tat ca nguoi dung co the xem danh sach; chi Premium xem duoc dap an chi tiet.
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
import { getExamHistory } from '../api/submissions';
import type { ExamHistoryItem } from '../api/submissions';
import { SUBJECT_CATALOG } from '../constants/subjects';

function subjectName(id: string): string {
  return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
}

interface Props {
  onBack: () => void;
}

export function SubmissionsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();
  const [items, setItems] = useState<ExamHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const isPremium = profile?.isPremium ?? false;
  const LIMIT = 10;

  useEffect(() => {
    if (!sessionToken) return;
    getExamHistory(sessionToken, LIMIT, 0)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setOffset(LIMIT);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [sessionToken]);

  async function handleLoadMore() {
    if (!sessionToken || loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await getExamHistory(sessionToken, LIMIT, offset);
      setItems((prev) => [...prev, ...res.items]);
      setOffset((o) => o + LIMIT);
    } catch {
      // im lang
    } finally {
      setLoadingMore(false);
    }
  }

  function renderItem({ item }: { item: ExamHistoryItem }) {
    const score = item.score ?? 0;
    const scoreColor = score >= 70 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#dc2626';
    return (
      <View style={[styles.historyItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.historyLeft}>
          <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.historySubject, { color: colors.primary }]}>{subjectName(item.subject)}</Text>
          <Text style={[styles.historyDate, { color: colors.textMuted }]}>
            {new Date(item.completedAt).toLocaleDateString('vi-VN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyScore, { color: scoreColor }]}>{score}</Text>
          <Text style={[styles.historyScoreLabel, { color: colors.textMuted }]}>điểm</Text>
          {item.pointsAwarded > 0 && (
            <Text style={[styles.historyPoints, { color: '#f59e0b' }]}>+{item.pointsAwarded}đ</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Quay lại</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>📋 Lịch sử bài thi</Text>
          {!isPremium && (
            <Text style={[styles.premiumNote, { color: '#7c3aed' }]}>Premium: xem đáp án chi tiết</Text>
          )}
        </View>
        <Text style={[styles.totalText, { color: colors.textMuted }]}>{total} bài</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chưa có bài thi nào</Text>
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            Vào tab Thi thử để bắt đầu bài thi đầu tiên!
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { void handleLoadMore(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  premiumNote: { fontSize: 11, marginTop: 1 },
  totalText: { marginLeft: 'auto', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  listContent: { padding: 16, gap: 10 },
  historyItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 14, gap: 12 },
  historyLeft: { flex: 1, gap: 3 },
  historyTitle: { fontSize: 15, fontWeight: '700' },
  historySubject: { fontSize: 12, fontWeight: '600' },
  historyDate: { fontSize: 12 },
  historyRight: { alignItems: 'flex-end', gap: 2 },
  historyScore: { fontSize: 24, fontWeight: '900' },
  historyScoreLabel: { fontSize: 11 },
  historyPoints: { fontSize: 12, fontWeight: '700' },
});
