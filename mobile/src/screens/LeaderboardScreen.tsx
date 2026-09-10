// Man hinh Bang Xep Hang — hien top 3 podium + danh sach con lai, loc theo mon hoc.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { getLeaderboard, getMyLeaderboardRank } from '../api/leaderboard';
import type { LeaderboardEntry, MyRankResponse, Trend } from '../api/leaderboard';
import { SUBJECT_CATALOG } from '../constants/subjects';

const TREND_ICON: Record<Trend, string> = { up: '↑', down: '↓', same: '→', new: '—' };
const TREND_COLOR: Record<Trend, string> = {
  up: '#22c55e', down: '#ef4444', same: '#94a3b8', new: '#94a3b8',
};
const MEDAL = ['🥇', '🥈', '🥉'];

export function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [myRank, setMyRank] = useState<MyRankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  // Popup chi tiet user khi bam vao 1 dong
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    // Reset page ve 1 thong qua ham rieng, khong goi setState dong bo trong effect
    Promise.all([
      getLeaderboard(sessionToken, 1, subject || undefined),
      getMyLeaderboardRank(sessionToken, subject || undefined),
    ])
      .then(([lb, me]) => {
        setPage(1);
        setEntries(lb.data);
        setTotal(lb.total);
        setMyRank(me);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [sessionToken, subject]);

  async function handleLoadMore() {
    if (!sessionToken || loadingMore || entries.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const lb = await getLeaderboard(sessionToken, nextPage, subject || undefined);
      setEntries((prev) => [...prev, ...lb.data]);
      setPage(nextPage);
    } catch {
      // im lang neu loi load more
    } finally {
      setLoadingMore(false);
    }
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const myEntryLoaded = entries.some((e) => e.userId === profile?.id);

  function renderEntry(item: LeaderboardEntry) {
    const isMe = item.userId === profile?.id;
    return (
      <TouchableOpacity
        key={item.userId}
        onPress={() => setSelected(item)}
        activeOpacity={0.75}
        style={[
          styles.entryRow,
          {
            backgroundColor: isMe ? colors.primary + '18' : colors.surface,
            borderColor: isMe ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.rank, { color: colors.textMuted }]}>#{item.rank}</Text>
        <View style={styles.entryInfo}>
          <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>
            {item.displayName ?? 'Ẩn danh'} {isMe ? '(bạn)' : ''}
          </Text>
          <Text style={[styles.entrySub, { color: colors.textMuted }]}>
            TB: {item.avgScore.toFixed(1)} · {item.examCount} bài thi
          </Text>
        </View>
        <View style={styles.entryRight}>
          <Text style={[styles.reputation, { color: colors.primary }]}>{item.reputationScore}</Text>
          <Text style={{ color: TREND_COLOR[item.trend], fontSize: 14 }}>{TREND_ICON[item.trend]}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Modal chi tiet nguoi dung */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={[styles.detailCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {selected && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.detailAvatarText}>
                      {(selected.displayName ?? '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={[styles.detailName, { color: colors.text }]}>
                      {selected.displayName ?? 'Ẩn danh'}
                    </Text>
                    <Text style={[styles.detailRank, { color: colors.primary }]}>Hạng #{selected.rank}</Text>
                  </View>
                  <Text style={{ color: TREND_COLOR[selected.trend], fontSize: 22, fontWeight: '700' }}>
                    {TREND_ICON[selected.trend]}
                  </Text>
                </View>

                <View style={[styles.detailStats, { borderTopColor: colors.border }]}>
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatVal, { color: colors.primary }]}>{selected.reputationScore}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textMuted }]}>Điểm uy tín</Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatVal, { color: colors.text }]}>{selected.avgScore.toFixed(1)}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textMuted }]}>Điểm TB</Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Text style={[styles.detailStatVal, { color: colors.text }]}>{selected.examCount}</Text>
                    <Text style={[styles.detailStatLabel, { color: colors.textMuted }]}>Số bài thi</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.detailCloseBtn, { borderColor: colors.border }]}
                  onPress={() => setSelected(null)}
                >
                  <Text style={[{ color: colors.text, fontSize: 14, fontWeight: '600' }]}>Đóng</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {/* Header gradient area */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>🏆 Bảng Xếp Hạng</Text>

        {/* Filter mon hoc */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: !subject ? colors.primary : colors.surface, borderColor: !subject ? colors.primary : colors.border }]}
            onPress={() => setSubject('')}
          >
            <Text style={{ color: !subject ? colors.primaryText : colors.text, fontSize: 13, fontWeight: '600' }}>Tất cả</Text>
          </TouchableOpacity>
          {SUBJECT_CATALOG.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.filterChip, { backgroundColor: subject === s.id ? colors.primary : colors.surface, borderColor: subject === s.id ? colors.primary : colors.border }]}
              onPress={() => setSubject(subject === s.id ? '' : s.id)}
            >
              <Text style={{ color: subject === s.id ? colors.primaryText : colors.text, fontSize: 13, fontWeight: '600' }}>
                {s.emoji} {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => renderEntry(item)}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { void handleLoadMore(); }}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            <>
              {/* Top 3 podium */}
              {top3.length > 0 && (
                <View style={styles.podiumArea}>
                  {[top3[1], top3[0], top3[2]].map((entry, podIdx) => {
                    if (!entry) return <View key={podIdx} style={{ flex: 1 }} />;
                    const realRank = podIdx === 1 ? 0 : podIdx === 0 ? 1 : 2;
                    const podiumHeights = [84, 60, 44];
                    return (
                      <View key={entry.userId} style={[styles.podiumItem, { flex: 1, alignItems: 'center' }]}>
                        <Text style={{ fontSize: 24 }}>{MEDAL[realRank]}</Text>
                        <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                          {entry.displayName ?? 'Ẩn danh'}
                        </Text>
                        <Text style={[styles.podiumScore, { color: colors.primary }]}>{entry.reputationScore}</Text>
                        <View style={[styles.podiumBar, { backgroundColor: colors.primary + (realRank === 0 ? 'FF' : '80'), height: podiumHeights[realRank] }]} />
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Hang cua minh (ghim neu chua load den) */}
              {myRank && myRank.rank && !myEntryLoaded && (
                <View style={[styles.myRankCard, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}>
                  <Text style={[styles.myRankText, { color: colors.primary }]}>
                    📍 Hạng của bạn: #{myRank.rank} · {myRank.reputationScore} điểm danh tiếng
                  </Text>
                </View>
              )}

              {rest.length > 0 && (
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>XẾP HẠNG</Text>
              )}
            </>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12, paddingHorizontal: 20, borderBottomWidth: 1, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  filterChip: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  podiumArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 8 },
  podiumItem: { gap: 4 },
  podiumName: { fontSize: 12, fontWeight: '600', textAlign: 'center', maxWidth: 80 },
  podiumScore: { fontSize: 13, fontWeight: '800' },
  podiumBar: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  myRankCard: { borderWidth: 1.5, borderRadius: 12, padding: 12, marginVertical: 8 },
  myRankText: { fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 8, marginBottom: 4 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    gap: 10,
  },
  rank: { fontSize: 13, fontWeight: '700', minWidth: 30 },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontWeight: '600' },
  entrySub: { fontSize: 12, marginTop: 2 },
  entryRight: { alignItems: 'flex-end', gap: 2 },
  reputation: { fontSize: 15, fontWeight: '800' },
  // Modal chi tiet
  modalOverlay: { flex: 1, backgroundColor: '#00000050', justifyContent: 'flex-end' },
  detailCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  detailAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 18, fontWeight: '800' },
  detailRank: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  detailStats: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, borderTopWidth: 1 },
  detailStatItem: { alignItems: 'center', gap: 4 },
  detailStatVal: { fontSize: 22, fontWeight: '900' },
  detailStatLabel: { fontSize: 12 },
  detailCloseBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
