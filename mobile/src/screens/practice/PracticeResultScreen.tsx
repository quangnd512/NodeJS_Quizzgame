// Man hinh Ket qua luyen tap — hien diem, so cau dung, diem thuong, va 2 nut hanh dong.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { PracticeStackScreenProps } from '../../navigation/types';

type Props = PracticeStackScreenProps<'PracticeResult'>;

export function PracticeResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { complete, subject, totalQuestions, correctCount } = route.params;

  const subjectInfo = SUBJECT_CATALOG.find((s) => s.id === subject);
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const grade = accuracy >= 90 ? '🏆 Xuất sắc!' : accuracy >= 70 ? '🌟 Tốt' : accuracy >= 50 ? '📚 Cần ôn thêm' : '💪 Cố gắng thêm';

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      {/* Danh gia */}
      <Text style={styles.gradeEmoji}>{grade.split(' ')[0]}</Text>
      <Text style={[styles.gradeText, { color: colors.text }]}>{grade.split(' ').slice(1).join(' ')}</Text>
      <Text style={[styles.subjectLabel, { color: colors.textMuted }]}>
        {subjectInfo?.emoji} {subjectInfo?.name ?? subject}
      </Text>

      {/* Cac chi so */}
      <View style={[styles.statsRow]}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{accuracy}%</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Độ chính xác</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{correctCount}/{totalQuestions}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Câu đúng</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>+{complete.pointsEarned}đ</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Điểm thưởng</Text>
        </View>
      </View>

      {/* Diem tong */}
      <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Điểm phiên này</Text>
        <Text style={[styles.scoreValue, { color: colors.primary }]}>{complete.score}</Text>
      </View>

      {/* Cac nut hanh dong */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => {
          // Quay lai man chon mon (pop stack 2 man hinh: Session + Result)
          navigation.pop(2);
        }}
      >
        <Text style={styles.btnText}>✏️ Luyện thêm</Text>
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
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16, alignItems: 'center' },
  gradeEmoji: { fontSize: 64, marginBottom: 4 },
  gradeText: { fontSize: 22, fontWeight: '800' },
  subjectLabel: { fontSize: 15, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  scoreCard: { borderWidth: 1, borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', gap: 4 },
  scoreLabel: { fontSize: 13 },
  scoreValue: { fontSize: 36, fontWeight: '800' },
  btn: { width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { width: '100%', borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
