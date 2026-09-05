// Man hinh Ket qua thi — Free: chi hien diem; Premium: hien day du dap an sai + phan tich.
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
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { getExamResult } from '../../api/exam';
import type { ExamResult, ExamChapterAnalysis, ExamWrongAnswer } from '../../api/exam';
import type { ExamStackScreenProps } from '../../navigation/types';

type Props = ExamStackScreenProps<'ExamResult'>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function ExamResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();
  const { sessionId } = route.params;

  const [result, setResult] = useState<ExamResult | null>(null);
  // Khoi tao true ngay tu dau — tranh goi setLoading(true) dong bo trong effect
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const isPremium = profile?.isPremium ?? false;

  useEffect(() => {
    // sessionToken luon co mat o man hinh nay (chi mo duoc khi da dang nhap)
    if (!sessionToken) return;
    getExamResult(sessionToken, sessionId)
      .then((res) => { setResult(res); })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Không thể tải kết quả.';
        setError(msg);
      })
      .finally(() => { setLoading(false); });
  }, [sessionToken, sessionId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Đang tải kết quả...</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>⚠️ {error ?? 'Không tìm thấy kết quả'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accuracy = result.totalQuestions > 0
    ? Math.round(((result.totalQuestions - result.wrongAnswers.length) / result.totalQuestions) * 100)
    : 0;
  const grade = result.score >= 90 ? '🏆 Xuất sắc' : result.score >= 70 ? '🌟 Tốt' : result.score >= 50 ? '📚 Đạt' : '💪 Chưa đạt';

  function renderWrongAnswer(wa: ExamWrongAnswer, idx: number) {
    const correctOpt = typeof wa.correctAnswer === 'number' ? OPTION_LABELS[wa.correctAnswer as number] : String(wa.correctAnswer);
    return (
      <View key={idx} style={[styles.waCard, { backgroundColor: colors.surface, borderColor: '#dc262640' }]}>
        <Text style={[styles.waQ, { color: colors.text }]}>{idx + 1}. {wa.questionText}</Text>
        {wa.questionType === 'MCQ_4' && (
          <View style={{ gap: 4, marginTop: 6 }}>
            <Text style={{ color: '#dc2626', fontSize: 13 }}>
              ✗ Bạn chọn: {OPTION_LABELS[wa.selectedAnswer as number]}. {wa.options?.[wa.selectedAnswer as number] ?? ''}
            </Text>
            <Text style={{ color: '#16a34a', fontSize: 13 }}>
              ✓ Đáp án đúng: {correctOpt}. {wa.options?.[wa.correctAnswer as number] ?? ''}
            </Text>
          </View>
        )}
        {wa.explanation && (
          <Text style={[styles.waExplain, { color: colors.textMuted }]}>💡 {wa.explanation}</Text>
        )}
      </View>
    );
  }

  function renderChapter(ch: ExamChapterAnalysis) {
    const pct = ch.totalCount > 0 ? Math.round((ch.correctCount / ch.totalCount) * 100) : 0;
    return (
      <View key={ch.chapter} style={[styles.chapterRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.chapterName, { color: colors.text }]}>{ch.chapter}</Text>
        <Text style={[styles.chapterStat, { color: pct >= 70 ? '#16a34a' : '#f59e0b' }]}>
          {ch.correctCount}/{ch.totalCount} ({pct}%)
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      {/* Tieu de */}
      <Text style={[styles.grade, { color: colors.text }]}>{grade}</Text>

      {/* Cac chi so chinh */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{result.score}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Điểm</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{accuracy}%</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Chính xác</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>+{result.pointsAwarded}đ</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Điểm thưởng</Text>
        </View>
      </View>

      {/* Premium gate cho phan phan tich */}
      {!isPremium ? (
        <View style={[styles.premiumGate, { backgroundColor: '#7c3aed18', borderColor: '#7c3aed' }]}>
          <Text style={{ color: '#7c3aed', fontSize: 15, fontWeight: '700' }}>🔒 Đáp án chi tiết</Text>
          <Text style={{ color: '#7c3aed', fontSize: 13, marginTop: 6 }}>
            Nâng cấp Premium để xem đáp án từng câu, phân tích theo chương, và nhận xét cải thiện.
          </Text>
        </View>
      ) : (
        <>
          {/* Phan tich theo chuong */}
          {result.chapterAnalysis.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 Phân tích theo chương</Text>
              {result.chapterAnalysis.map(renderChapter)}
            </View>
          )}

          {/* Cac cau sai */}
          {result.wrongAnswers.length > 0 && (
            <View>
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowDetail((v) => !v)}
              >
                <Text style={[styles.toggleBtnText, { color: colors.text }]}>
                  {showDetail ? '▲ Ẩn' : '▼ Xem'} {result.wrongAnswers.length} câu làm sai
                </Text>
              </TouchableOpacity>
              {showDetail && result.wrongAnswers.map(renderWrongAnswer)}
            </View>
          )}

          {result.wrongAnswers.length === 0 && (
            <View style={[styles.perfectCard, { backgroundColor: '#16a34a18', borderColor: '#16a34a' }]}>
              <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 15 }}>🎉 Không có câu sai!</Text>
            </View>
          )}
        </>
      )}

      {/* Cac nut hanh dong */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.pop(2)}
      >
        <Text style={styles.btnText}>📝 Thi lại</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btnOutline, { borderColor: colors.border }]}
        onPress={() => navigation.getParent()?.navigate('Progress')}
      >
        <Text style={[styles.btnOutlineText, { color: colors.text }]}>📊 Xem tiến độ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  grade: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  premiumGate: { borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 4 },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 0 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  chapterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  chapterName: { fontSize: 13, flex: 1 },
  chapterStat: { fontSize: 13, fontWeight: '700' },
  toggleBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  toggleBtnText: { fontSize: 14, fontWeight: '600' },
  waCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4, marginTop: 8 },
  waQ: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  waExplain: { fontSize: 13, marginTop: 6, lineHeight: 19 },
  perfectCard: { borderWidth: 1.5, borderRadius: 12, padding: 16, alignItems: 'center' },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
