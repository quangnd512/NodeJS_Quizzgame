// Man hinh Tien do — hien streak hoc hang ngay, tong quan thong ke, lich su diem thi.
// Premium: them phan phan tich chi tiet theo mon + streak freeze.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { getProgressSummary } from '../api/progress';
import type { ProgressSummary } from '../api/progress';
import { SUBJECT_CATALOG } from '../constants/subjects';

function subjectName(id: string): string {
  return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
}

export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    getProgressSummary(sessionToken)
      .then((res) => { setSummary(res); })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Không thể tải tiến độ.';
        setError(msg);
      })
      .finally(() => { setLoading(false); });
  }, [sessionToken]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>⚠️ {error ?? 'Không thể tải tiến độ'}</Text>
      </View>
    );
  }

  const { overview, bestStreak, monthComparison, practiceStatsBySubject, scoreTrend, isPremium, streakFreeze } = summary;

  // Streak hien tai: xay dung "calendar" 7 ngay de hien thi
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  // scoreTrend chua ngay tap luyen — dung de to mau ngay co luyen tap
  const activeDates = new Set(scoreTrend.map((p) => p.date.substring(0, 10)));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>📊 Tiến độ</Text>

      {/* Streak hien tai */}
      <View style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.streakMain}>
          <Text style={styles.streakFlame}>🔥</Text>
          <View>
            <Text style={[styles.streakNum, { color: colors.primary }]}>{overview.currentStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>ngày liên tiếp</Text>
          </View>
          <View style={styles.streakBest}>
            <Text style={[styles.streakBestNum, { color: colors.text }]}>🏆 {bestStreak}</Text>
            <Text style={[styles.streakBestLabel, { color: colors.textMuted }]}>Kỷ lục</Text>
          </View>
        </View>

        {/* Lich 7 ngay */}
        <View style={styles.weekRow}>
          {last7Days.map((d, i) => {
            const iso = d.toISOString().substring(0, 10);
            const isToday = i === 6;
            const hasActivity = activeDates.has(iso);
            return (
              <View key={iso} style={[styles.dayDot, {
                backgroundColor: hasActivity ? colors.primary : colors.border,
                borderWidth: isToday ? 2 : 0,
                borderColor: colors.primary,
              }]}>
                <Text style={{ fontSize: 10, color: hasActivity ? colors.primaryText : colors.textMuted, fontWeight: '600' }}>
                  {d.toLocaleDateString('vi-VN', { weekday: 'narrow' })}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Premium: streak freeze */}
        {isPremium && (
          <Text style={[styles.freezeLabel, { color: colors.textMuted }]}>
            🛡️ Thẻ bảo hiểm chuỗi: {streakFreeze.remaining} còn lại / {streakFreeze.granted} đã cấp
          </Text>
        )}
      </View>

      {/* Tong quan so lieu */}
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewValue, { color: colors.primary }]}>{overview.totalPracticeSessions}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Phiên luyện</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewValue, { color: colors.text }]}>{overview.totalExamSessions}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Bài thi</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewValue, { color: '#f59e0b' }]}>{overview.currentPoints}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Tổng điểm</Text>
        </View>
      </View>

      {/* So sanh thang nay voi thang truoc */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Tháng này vs. tháng trước</Text>
        <View style={styles.compRow}>
          <View style={styles.compCol}>
            <Text style={[styles.compLabel, { color: colors.textMuted }]}>Phiên luyện tập</Text>
            <Text style={[styles.compValue, { color: colors.text }]}>
              {monthComparison.thisMonth.practiceSessions} (trước: {monthComparison.lastMonth.practiceSessions})
            </Text>
          </View>
          <View style={styles.compCol}>
            <Text style={[styles.compLabel, { color: colors.textMuted }]}>TB điểm thi</Text>
            <Text style={[styles.compValue, { color: colors.text }]}>
              {monthComparison.thisMonth.examAvgScore?.toFixed(1) ?? '—'} (trước: {monthComparison.lastMonth.examAvgScore?.toFixed(1) ?? '—'})
            </Text>
          </View>
        </View>
      </View>

      {/* Thong ke theo mon — chi hien khi co du lieu */}
      {practiceStatsBySubject.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📚 Kết quả theo môn</Text>
          {practiceStatsBySubject.map((stat) => (
            <View key={stat.subject} style={[styles.statRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.statSubject, { color: colors.text }]}>{subjectName(stat.subject)}</Text>
              <View style={styles.statNums}>
                <Text style={[styles.statNum, { color: colors.primary }]}>TB: {stat.avgScore.toFixed(1)}</Text>
                <Text style={[styles.statNum, { color: colors.textMuted }]}>Max: {stat.bestScore}</Text>
                <Text style={[styles.statNum, { color: colors.textMuted }]}>{stat.totalSessions} phiên</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Premium gate cho phan phan tich chi tiet */}
      {!isPremium && (
        <View style={[styles.premiumCard, { backgroundColor: '#7c3aed18', borderColor: '#7c3aed' }]}>
          <Text style={{ color: '#7c3aed', fontWeight: '700', fontSize: 14 }}>🔒 Phân tích chuyên sâu</Text>
          <Text style={{ color: '#7c3aed', fontSize: 13, marginTop: 4 }}>
            Nâng cấp Premium để xem biểu đồ xu hướng điểm, thống kê theo mức độ khó và thẻ bảo hiểm chuỗi.
          </Text>
        </View>
      )}

      {/* Xu huong diem thi (chi Premium) */}
      {isPremium && scoreTrend.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📈 Xu hướng điểm thi (gần nhất)</Text>
          {scoreTrend.slice(-5).map((p, i) => (
            <View key={i} style={[styles.trendRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.trendDate, { color: colors.textMuted }]}>
                {new Date(p.date).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })}
              </Text>
              <Text style={[styles.trendSubject, { color: colors.text }]}>{subjectName(p.subject)}</Text>
              <Text style={[styles.trendScore, { color: p.score >= 70 ? '#16a34a' : '#f59e0b' }]}>{p.score}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  streakCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 },
  streakMain: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakFlame: { fontSize: 36 },
  streakNum: { fontSize: 36, fontWeight: '900' },
  streakLabel: { fontSize: 13, marginTop: -4 },
  streakBest: { marginLeft: 'auto', alignItems: 'flex-end' },
  streakBestNum: { fontSize: 18, fontWeight: '700' },
  streakBestLabel: { fontSize: 12 },
  weekRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dayDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  freezeLabel: { fontSize: 12, textAlign: 'center' },
  overviewRow: { flexDirection: 'row', gap: 10 },
  overviewCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  overviewValue: { fontSize: 22, fontWeight: '800' },
  overviewLabel: { fontSize: 11, textAlign: 'center' },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  compRow: { gap: 8 },
  compCol: { gap: 2 },
  compLabel: { fontSize: 12 },
  compValue: { fontSize: 14, fontWeight: '600' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  statSubject: { fontSize: 14, fontWeight: '600', flex: 1 },
  statNums: { flexDirection: 'row', gap: 10 },
  statNum: { fontSize: 12, fontWeight: '600' },
  premiumCard: { borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 10 },
  trendDate: { fontSize: 12, width: 56 },
  trendSubject: { flex: 1, fontSize: 13 },
  trendScore: { fontSize: 15, fontWeight: '700' },
});
