// Man hinh Tien do — hien streak hoc hang ngay, tong quan thong ke, lich su diem thi.
// Premium: them phan phan tich chi tiet theo mon + streak freeze.
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
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { getProgressSummary, getExamHistory } from '../api/progress';
import type { ProgressSummary, ExamHistoryItem } from '../api/progress';
import { SUBJECT_CATALOG } from '../constants/subjects';

function subjectName(id: string): string {
  return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
}

const EXAM_PAGE_SIZE = 10;

export function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lich su thi thu — phan trang bang offset
  const [examHistory, setExamHistory] = useState<ExamHistoryItem[]>([]);
  const [examTotal, setExamTotal] = useState(0);
  const [examOffset, setExamOffset] = useState(0);
  // Khoi tao true vi fetch ngay khi mount — tranh flicker "Chua co bai thi nao"
  const [examLoading, setExamLoading] = useState(true);

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

  // Fetch lich su thi lan dau khi mount (chi Premium moi xem duoc)
  useEffect(() => {
    if (!sessionToken) return;
    getExamHistory(sessionToken, EXAM_PAGE_SIZE, 0)
      .then((res) => {
        setExamHistory(res.items);
        setExamTotal(res.total);
        setExamOffset(res.items.length);
      })
      .catch(() => {})
      .finally(() => { setExamLoading(false); });
  }, [sessionToken]);

  async function handleLoadMoreExams() {
    if (!sessionToken || examLoading || examHistory.length >= examTotal) return;
    setExamLoading(true);
    try {
      const res = await getExamHistory(sessionToken, EXAM_PAGE_SIZE, examOffset);
      setExamHistory((prev) => [...prev, ...res.items]);
      setExamOffset((prev) => prev + res.items.length);
    } catch {
      // im lang neu loi load more
    } finally {
      setExamLoading(false);
    }
  }

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

      {/* Tong quan so lieu — 4 ô như website */}
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Phiên ôn tập</Text>
          <Text style={[styles.overviewValue, { color: colors.primary }]}>{overview.totalPracticeSessions}</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Lần thi thử</Text>
          <Text style={[styles.overviewValue, { color: colors.text }]}>{overview.totalExamSessions}</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Điểm tích lũy</Text>
          <Text style={[styles.overviewValue, { color: '#f59e0b' }]}>{overview.currentPoints}</Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Số ngày giữ chuỗi</Text>
          <Text style={[styles.overviewValue, { color: colors.primary }]}>{overview.currentStreak}</Text>
          <Text style={[styles.overviewSub, { color: colors.textMuted }]}>ngày 🔥</Text>
        </View>
      </View>

      {/* So sanh thang nay voi thang truoc */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Tháng này vs. tháng trước</Text>
        <View style={styles.monthCompareGrid}>
          <View style={styles.monthCol}>
            <Text style={[styles.monthLabel, { color: colors.textMuted }]}>Tháng này</Text>
            <View style={styles.monthRow}>
              <Text style={[styles.monthRowLabel, { color: colors.textMuted }]}>Phiên ôn tập</Text>
              <Text style={[styles.monthRowValue, { color: colors.text }]}>
                {monthComparison.thisMonth.practiceSessions}
              </Text>
            </View>
            <View style={styles.monthRow}>
              <Text style={[styles.monthRowLabel, { color: colors.textMuted }]}>Điểm thi TB</Text>
              <Text style={[styles.monthRowValue, { color: colors.text }]}>
                {monthComparison.thisMonth.examAvgScore?.toFixed(1) ?? '—'}
              </Text>
            </View>
          </View>
          <View style={styles.monthDivider} />
          <View style={styles.monthCol}>
            <Text style={[styles.monthLabel, { color: colors.textMuted }]}>Tháng trước</Text>
            <View style={styles.monthRow}>
              <Text style={[styles.monthRowLabel, { color: colors.textMuted }]}>Phiên ôn tập</Text>
              <Text style={[styles.monthRowValue, { color: colors.text }]}>
                {monthComparison.lastMonth.practiceSessions}
              </Text>
            </View>
            <View style={styles.monthRow}>
              <Text style={[styles.monthRowLabel, { color: colors.textMuted }]}>Điểm thi TB</Text>
              <Text style={[styles.monthRowValue, { color: colors.text }]}>
                {monthComparison.lastMonth.examAvgScore?.toFixed(1) ?? '—'}
              </Text>
            </View>
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

      {/* Lich su thi thu (chi Premium) */}
      {isPremium ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📋 Lịch sử thi thử {examTotal > 0 ? `(${examTotal})` : ''}
          </Text>
          {examHistory.length === 0 && !examLoading ? (
            <Text style={[styles.premiumNotice, { color: colors.textMuted }]}>Chưa có bài thi nào.</Text>
          ) : (
            examHistory.map((item) => (
              <View key={item.id} style={[styles.examRow, { borderBottomColor: colors.border }]}>
                <View style={styles.examInfo}>
                  <Text style={[styles.examTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.examSubject, { color: colors.textMuted }]}>{subjectName(item.subject)}</Text>
                </View>
                <View style={styles.examRight}>
                  <Text style={[styles.examScore, { color: item.score !== null && item.score >= 70 ? '#16a34a' : '#f59e0b' }]}>
                    {item.score !== null ? `${item.score}đ` : '—'}
                  </Text>
                  <Text style={[styles.examDate, { color: colors.textMuted }]}>
                    {new Date(item.completedAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))
          )}
          {examLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}
          {!examLoading && examHistory.length < examTotal && (
            <TouchableOpacity
              onPress={() => { void handleLoadMoreExams(); }}
              style={[styles.loadMoreBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>Xem thêm</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.premiumLockedBanner]}>
          <Text style={[styles.premiumLockedIcon]}>⭐</Text>
          <Text style={[styles.premiumLockedTitle, { color: colors.text }]}>Lịch sử thi thử là quyền lợi Premium</Text>
          <Text style={[styles.premiumLockedSub, { color: colors.textMuted }]}>Nâng cấp Premium để xem lịch sử thi thử chi tiết.</Text>
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
  overviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  overviewCard: { width: '48%', borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  overviewValue: { fontSize: 28, fontWeight: '800' },
  overviewLabel: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  overviewSub: { fontSize: 11 },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  monthCompareGrid: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  monthCol: { flex: 1, gap: 8 },
  monthDivider: { width: 1, backgroundColor: '#e2e4ea', marginVertical: 0 },
  monthLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  monthRowLabel: { fontSize: 13 },
  monthRowValue: { fontSize: 14, fontWeight: '600' },
  compRow: { gap: 8 },
  compCol: { gap: 2 },
  compLabel: { fontSize: 12 },
  compValue: { fontSize: 14, fontWeight: '600' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  statSubject: { fontSize: 14, fontWeight: '600', flex: 1 },
  statNums: { flexDirection: 'row', gap: 10 },
  statNum: { fontSize: 12, fontWeight: '600' },
  premiumCard: { borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 4 },
  premiumLockedBanner: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  premiumLockedIcon: { fontSize: 36, marginBottom: 8 },
  premiumLockedTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  premiumLockedSub: { fontSize: 13, textAlign: 'center' },
  premiumNotice: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  examRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  examInfo: { flex: 1 },
  examTitle: { fontSize: 14, fontWeight: '600' },
  examSubject: { fontSize: 12, marginTop: 2 },
  examRight: { alignItems: 'flex-end', gap: 2 },
  examScore: { fontSize: 15, fontWeight: '800' },
  examDate: { fontSize: 11 },
  loadMoreBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  loadMoreText: { fontSize: 14, fontWeight: '600' },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 10 },
  trendDate: { fontSize: 12, width: 56 },
  trendSubject: { flex: 1, fontSize: 13 },
  trendScore: { fontSize: 15, fontWeight: '700' },
});
