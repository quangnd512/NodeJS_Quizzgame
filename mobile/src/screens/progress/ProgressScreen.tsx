// Man hinh Tien do hoc tap — streak, diem, bieu do don gian, lich su bai thi.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { getProgressSummary, type ProgressSummary } from '../../api/progress';
import type { ProgressStackScreenProps } from '../../navigation/types';

type Props = ProgressStackScreenProps<'ProgressHome'>;

export function ProgressScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getProgressSummary(sessionToken)
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(() => { /* show nothing if fails */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const overview = summary?.overview;
  const isPremium = summary?.isPremium ?? false;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>📊 Tiến độ học tập</Text>

      {/* Streak & Diem */}
      <View style={styles.row2}>
        <View style={[styles.card2, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardEmoji}>🔥</Text>
          <Text style={[styles.cardBig, { color: colors.text }]}>{overview?.currentStreak ?? 0}</Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Ngày liên tiếp</Text>
        </View>
        <View style={[styles.card2, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardEmoji}>⭐</Text>
          <Text style={[styles.cardBig, { color: colors.text }]}>{overview?.currentPoints ?? 0}</Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Điểm tích lũy</Text>
        </View>
      </View>

      {/* Best streak & Premium */}
      <View style={styles.row2}>
        <View style={[styles.card2, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardEmoji}>🏅</Text>
          <Text style={[styles.cardBig, { color: colors.text }]}>{summary?.bestStreak ?? 0}</Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Streak tốt nhất</Text>
        </View>
        <View style={[styles.card2, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.cardEmoji}>{isPremium ? '💎' : '🔓'}</Text>
          <Text style={[styles.cardBig, { color: isPremium ? colors.primary : colors.textMuted, fontSize: 14 }]}>
            {isPremium ? 'Premium' : 'Free'}
          </Text>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Gói tài khoản</Text>
        </View>
      </View>

      {/* Thong ke thang */}
      {summary?.monthComparison && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 So sánh tháng</Text>
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={[styles.compareLabel, { color: colors.textMuted }]}>Tháng này</Text>
              <Text style={[styles.compareVal, { color: colors.text }]}>
                {summary.monthComparison.thisMonth.practiceSessions} phiên ôn
              </Text>
              <Text style={[styles.compareVal, { color: colors.text }]}>
                TB {(summary.monthComparison.thisMonth.examAvgScore ?? 0).toFixed(1)}/10
              </Text>
            </View>
            <Text style={[styles.vs, { color: colors.textMuted }]}>vs</Text>
            <View style={[styles.compareCol, { alignItems: 'flex-end' }]}>
              <Text style={[styles.compareLabel, { color: colors.textMuted }]}>Tháng trước</Text>
              <Text style={[styles.compareVal, { color: colors.text }]}>
                {summary.monthComparison.lastMonth.practiceSessions} phiên ôn
              </Text>
              <Text style={[styles.compareVal, { color: colors.text }]}>
                TB {(summary.monthComparison.lastMonth.examAvgScore ?? 0).toFixed(1)}/10
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Bieu do xu huong diem (don gian: danh sach) */}
      {summary && summary.scoreTrend.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📈 Xu hướng điểm gần đây</Text>
          {summary.scoreTrend.slice(-5).map((pt, i) => (
            <View key={i} style={styles.trendRow}>
              <Text style={[styles.trendDate, { color: colors.textMuted }]}>{pt.date.slice(0, 10)}</Text>
              <Text style={[styles.trendSubject, { color: colors.textMuted }]}>{pt.subject}</Text>
              <Text style={[styles.trendScore, { color: colors.primary }]}>{pt.score.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Nut On cau sai (chi Premium) */}
      <TouchableOpacity
        style={[
          styles.wrongBtn,
          { backgroundColor: isPremium ? colors.primary : colors.border },
        ]}
        onPress={() => isPremium ? navigation.navigate('WrongAnswerList') : null}
        disabled={!isPremium}
      >
        <Text style={[styles.wrongBtnText, { color: isPremium ? colors.primaryText : colors.textMuted }]}>
          {isPremium ? '📚 Ôn câu sai' : '📚 Ôn câu sai (Premium)'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  row2: { flexDirection: 'row', gap: 12 },
  card2: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  cardEmoji: { fontSize: 28 },
  cardBig: { fontSize: 24, fontWeight: '800' },
  cardLabel: { fontSize: 12 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  compareRow: { flexDirection: 'row', alignItems: 'center' },
  compareCol: { flex: 1, gap: 4 },
  compareLabel: { fontSize: 12, fontWeight: '600' },
  compareVal: { fontSize: 14 },
  vs: { fontSize: 13, paddingHorizontal: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendDate: { fontSize: 12, width: 80 },
  trendSubject: { flex: 1, fontSize: 13 },
  trendScore: { fontSize: 15, fontWeight: '700' },
  wrongBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  wrongBtnText: { fontWeight: '700', fontSize: 15 },
});
