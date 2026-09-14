// Man hinh bang xep hang hoc sinh theo Diem Uy Tin.
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
import { useAppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { getLeaderboard, getMyRank, type LeaderboardEntry, type MyRankResponse } from '../../api/leaderboard';
import { SUBJECT_CATALOG } from '../../constants/subjects';

const TREND_ICON: Record<string, string> = {
  up: '↑',
  down: '↓',
  same: '–',
  new: '🆕',
};

export function LeaderboardScreen() {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<MyRankResponse | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      getLeaderboard(sessionToken, selectedSubject),
      getMyRank(sessionToken),
    ])
      .then(([board, rank]) => {
        if (!cancelled) {
          setEntries(board.data);
          setMyRank(rank);
        }
      })
      .catch(() => { /* im lang */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken, selectedSubject]);

  const SUBJECTS_WITH_ALL = [
    { id: undefined as string | undefined, name: 'Tổng hợp', emoji: '🌟' },
    ...SUBJECT_CATALOG.map((s) => ({ id: s.id as string | undefined, name: s.name, emoji: s.emoji })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={styles.emoji}>🏆</Text>
        <Text style={[styles.title, { color: colors.text }]}>Xếp hạng</Text>
        {myRank?.rank !== null && myRank?.rank !== undefined && (
          <Text style={[styles.myRankBadge, { color: colors.primary }]}>
            Hạng của bạn: #{myRank.rank}
          </Text>
        )}
      </View>

      {/* Subject filter */}
      <FlatList
        horizontal
        data={SUBJECTS_WITH_ALL}
        keyExtractor={(item) => item.id ?? 'all'}
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => {
          const active = item.id === selectedSubject;
          return (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedSubject(item.id)}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                {item.emoji} {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.rank, { color: item.rank <= 3 ? colors.primary : colors.textMuted }]}>
                {item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : `#${item.rank}`}
              </Text>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: colors.text }]}>
                  {item.displayName ?? 'Ẩn danh'}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                  {item.reputationScore} điểm · TB {item.avgScore.toFixed(1)}/10
                </Text>
              </View>
              <Text
                style={[
                  styles.trend,
                  { color: item.trend === 'up' ? '#16a34a' : item.trend === 'down' ? colors.danger : colors.textMuted },
                ]}
              >
                {TREND_ICON[item.trend] ?? ''}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>Chưa có dữ liệu xếp hạng.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  emoji: { fontSize: 36, marginTop: 12, marginBottom: 2 },
  title: { fontSize: 22, fontWeight: '800' },
  myRankBadge: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  filterBar: { maxHeight: 52, borderBottomWidth: 0 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  rank: { fontSize: 18, width: 40, textAlign: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  trend: { fontSize: 18, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
