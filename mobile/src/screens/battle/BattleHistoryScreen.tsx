// Man hinh Lich su thi dau — hien danh sach tran da danh (phan trang, page size 10).
// Tham khao: frontend/src/screens/battle/BattleHistoryPage.tsx
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
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { getBattleHistory } from '../../api/battle';
import type { BattleHistoryItem, BattleResult } from '../../api/battle';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { BattleStackScreenProps } from '../../navigation/types';

type Props = BattleStackScreenProps<'BattleHistory'>;

const PAGE_SIZE = 10;

// Nhan biet ket qua tran dau
const RESULT_LABEL: Record<BattleResult, { text: string; color: string }> = {
  WIN: { text: 'THẮNG', color: '#16a34a' },
  LOSE: { text: 'THUA', color: '#dc2626' },
  DRAW: { text: 'HOÀ', color: '#ca8a04' },
};

export function BattleHistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const [items, setItems] = useState<BattleHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadPage(pageIndex: number, replace: boolean) {
    if (!sessionToken) return;
    if (pageIndex === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getBattleHistory(sessionToken, PAGE_SIZE, pageIndex * PAGE_SIZE);
      setTotal(res.total);
      setItems((prev) => replace ? res.items : [...prev, ...res.items]);
      setPage(pageIndex);
    } catch {
      // im lang neu loi — FlatList van hien du lieu cu
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- loadPage goi API va setState de dong bo voi sessionToken (cung pattern voi BattleHistoryPage.tsx)
  useEffect(() => { void loadPage(0, true); }, [sessionToken]);

  function getSubjectName(id: string): string {
    return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
  }

  function renderItem({ item }: { item: BattleHistoryItem }) {
    const result = RESULT_LABEL[item.result as BattleResult] ?? { text: item.result, color: colors.textMuted };
    const pointsColor = item.pointsChange >= 0 ? '#16a34a' : '#dc2626';
    const pointsText = (item.pointsChange >= 0 ? '+' : '') + item.pointsChange.toLocaleString('vi-VN');
    const dateStr = new Date(item.completedAt).toLocaleDateString('vi-VN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Hang 1: Mon hoc + Ket qua + Diem */}
        <View style={styles.cardRow}>
          <Text style={[styles.subject, { color: colors.text }]}>
            ⚔️ {getSubjectName(item.subject)}
          </Text>
          <View style={[styles.resultBadge, { borderColor: result.color + '60', backgroundColor: result.color + '15' }]}>
            <Text style={[styles.resultText, { color: result.color }]}>{result.text}</Text>
          </View>
        </View>

        {/* Hang 2: Doi thu + Ti so */}
        <View style={styles.cardRow}>
          <Text style={[styles.opponent, { color: colors.textMuted }]}>
            vs {item.opponentName ?? 'Người chơi'}
          </Text>
          <Text style={[styles.score, { color: colors.text }]}>
            {item.myScore} – {item.opponentScore}
          </Text>
        </View>

        {/* Hang 3: Ngay + Thay doi diem */}
        <View style={styles.cardRow}>
          <Text style={[styles.date, { color: colors.textMuted }]}>{dateStr}</Text>
          <Text style={[styles.points, { color: pointsColor }]}>{pointsText} điểm</Text>
        </View>
      </View>
    );
  }

  const hasMore = items.length < total;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>⚔️ Lịch sử thi đấu</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏁</Text>
          <Text style={[{ color: colors.textMuted, fontSize: 15 }]}>Chưa có trận đấu nào.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                onPress={() => { void loadPage(page + 1, false); }}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>Xem thêm</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, gap: 10 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subject: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  resultBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  resultText: { fontSize: 12, fontWeight: '700' },
  opponent: { fontSize: 13, flex: 1 },
  score: { fontSize: 14, fontWeight: '600' },
  date: { fontSize: 12 },
  points: { fontSize: 13, fontWeight: '600' },
  loadMoreBtn: {
    marginTop: 8,
    marginHorizontal: 32,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
});
