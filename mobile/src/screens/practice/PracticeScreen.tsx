// Man hinh Luyen tap — chon mon hoc de bat dau phien luyen tap.
// Hien danh sach mon hoc + lich su gan day + stats tung mon (tuong duong web PracticePage).
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { startPracticeSession, getPracticeHistory, getPracticeStats } from '../../api/practice';
import type { PracticeHistoryItem, SubjectStat } from '../../api/practice';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { PracticeStackScreenProps } from '../../navigation/types';

type Props = PracticeStackScreenProps<'PracticeHome'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export function PracticeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile, sessionToken } = useAuth();
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);

  // Lich su gan day (3-5 phien)
  const [recentHistory, setRecentHistory] = useState<PracticeHistoryItem[]>([]);
  // Stats tung mon
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);

  // Chi hien mon hoc nguoi dung da chon khi onboarding
  const mySubjects = SUBJECT_CATALOG.filter(
    (s) => profile?.subjects.some((ps) => ps.id === s.id),
  );

  useEffect(() => {
    if (!sessionToken) return;
    // Fetch history va stats song song
    Promise.all([
      getPracticeHistory(sessionToken),
      getPracticeStats(sessionToken),
    ])
      .then(([hist, stats]) => {
        setRecentHistory(hist.items.slice(0, 5));
        setSubjectStats(stats);
      })
      .catch(() => {});
  }, [sessionToken]);

  async function handleStart(subjectId: string) {
    if (!sessionToken) return;
    setLoadingSubject(subjectId);
    try {
      const result = await startPracticeSession(sessionToken, subjectId);
      navigation.navigate('PracticeSession', { session: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu luyện tập.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoadingSubject(null);
    }
  }

  function getStatForSubject(subjectId: string): SubjectStat | undefined {
    return subjectStats.find((s) => s.subject === subjectId);
  }

  function subjectName(id: string): string {
    return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>✏️ Luyện tập</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Chọn môn để bắt đầu phiên luyện tập ngẫu nhiên (10 câu)
      </Text>

      {/* Section: Lich su gan day */}
      {recentHistory.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🕐 Gần đây</Text>
          {recentHistory.map((item) => (
            <View key={item.sessionId} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
              <View style={styles.historyInfo}>
                <Text style={[styles.historySubject, { color: colors.text }]}>{subjectName(item.subjectId)}</Text>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDate(item.completedAt)}</Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={[styles.historyScore, { color: item.score >= 7 ? '#16a34a' : '#f59e0b' }]}>
                  {item.score}/{item.totalQuestions}
                </Text>
                <Text style={[styles.historyPoints, { color: colors.textMuted }]}>+{item.pointsEarned}đ</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Danh sach mon hoc */}
      {mySubjects.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Bạn chưa chọn môn học. Vào Hồ sơ → chỉnh sửa môn học để chọn.
          </Text>
        </View>
      ) : (
        mySubjects.map((s) => {
          const isLoading = loadingSubject === s.id;
          const stat = getStatForSubject(s.id);
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { void handleStart(s.id); }}
              disabled={loadingSubject !== null}
              activeOpacity={0.75}
            >
              <Text style={styles.emoji}>{s.emoji}</Text>
              <View style={styles.subjectInfo}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{s.name}</Text>
                {stat ? (
                  <Text style={[styles.subjectStat, { color: colors.textMuted }]}>
                    {stat.totalSessions} phiên · Cao nhất: {stat.bestScore}/{10}
                  </Text>
                ) : (
                  <Text style={[styles.subjectStat, { color: colors.textMuted }]}>10 câu ngẫu nhiên</Text>
                )}
              </View>
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.arrow, { color: colors.primary }]}>›</Text>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 4 },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  historyInfo: { flex: 1 },
  historySubject: { fontSize: 14, fontWeight: '600' },
  historyDate: { fontSize: 12, marginTop: 1 },
  historyRight: { alignItems: 'flex-end', gap: 1 },
  historyScore: { fontSize: 15, fontWeight: '800' },
  historyPoints: { fontSize: 11 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  emoji: { fontSize: 28 },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '700' },
  subjectStat: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 24, fontWeight: '300' },
});
