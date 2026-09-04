// Man hinh ket qua bai thi — hien thi diem + phan tich.
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
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { getExamResult, type ExamResultResponse } from '../../api/exam.js';
import type { ExamStackScreenProps } from '../../navigation/types.js';

type Props = ExamStackScreenProps<'ExamResult'>;

export function ExamResultScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { sessionId } = route.params;

  const [result, setResult] = useState<ExamResultResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    getExamResult(sessionToken, sessionId)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [sessionToken, sessionId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Đang tải kết quả...</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>Không tải được kết quả.</Text>
      </View>
    );
  }

  const score = result.score ?? 0;
  const emoji = score >= 8 ? '🎉' : score >= 6 ? '👍' : '📚';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }]}>Kết quả bài thi</Text>

      {/* Diem so */}
      <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Điểm số</Text>
          <Text style={[styles.scoreValue, { color: colors.text }]}>{score.toFixed(1)}/10</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Điểm tích lũy</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>+{result.pointsAwarded}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Số câu</Text>
          <Text style={[styles.scoreValue, { color: colors.text }]}>{result.totalQuestions}</Text>
        </View>
      </View>

      {/* Phan tich theo chuong */}
      {result.chapterAnalysis.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Phân tích theo chương</Text>
          {result.chapterAnalysis.map((ch, i) => (
            <View key={i} style={styles.chapterRow}>
              <Text style={[styles.chapterName, { color: colors.text }]}>{ch.chapter}</Text>
              <Text style={[styles.chapterStat, { color: colors.textMuted }]}>
                {ch.correctCount}/{ch.totalCount} câu đúng
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('ExamList')}
      >
        <Text style={[styles.btnText, { color: colors.primaryText }]}>Thi đề khác</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, alignItems: 'center', gap: 16 },
  emoji: { fontSize: 60, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  scoreCard: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 20 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, marginVertical: 2 },
  scoreLabel: { fontSize: 15 },
  scoreValue: { fontSize: 18, fontWeight: '700' },
  section: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  chapterRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chapterName: { fontSize: 14 },
  chapterStat: { fontSize: 13 },
  btn: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnText: { fontWeight: '700', fontSize: 16 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 15, textAlign: 'center', margin: 32 },
});
