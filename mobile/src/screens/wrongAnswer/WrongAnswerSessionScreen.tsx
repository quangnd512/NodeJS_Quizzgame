// Man hinh on luyen lai 1 cau sai — hien thi cau + nhan dap an.
import React, { useState } from 'react';
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
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { retryWrongAnswer, type RetryResult } from '../../api/wrongAnswer.js';
import type { ProgressStackScreenProps } from '../../navigation/types.js';

type Props = ProgressStackScreenProps<'WrongAnswerSession'>;

export function WrongAnswerSessionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { id, questionContent } = route.params;

  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<RetryResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = async (optionIndex: number) => {
    if (!sessionToken || result) return;
    setSelected(optionIndex);
    setSubmitting(true);
    try {
      const res = await retryWrongAnswer(sessionToken, id, optionIndex);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể nộp đáp án.';
      Alert.alert('Lỗi', msg);
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Giai lap options MCQ don gian — cau sai thuc te la MCQ_4
  // (wrong answer chi lay dieu kien MCQ_4 vi cau TRUE_FALSE / FILL_BLANK xu ly phuc tap hon)
  const OPTIONS = ['A', 'B', 'C', 'D'];

  const correctAnswer =
    result !== null && typeof result.correctAnswer === 'number' ? result.correctAnswer : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ôn lại câu sai</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.question, { color: colors.text }]}>{questionContent}</Text>

        {OPTIONS.map((label, i) => {
          let borderColor = colors.border;
          let bgColor = colors.surface;

          if (result !== null) {
            if (i === correctAnswer) {
              borderColor = '#16a34a';
              bgColor = '#dcfce7';
            } else if (i === selected && i !== correctAnswer) {
              borderColor = colors.danger;
              bgColor = '#fee2e2';
            }
          } else if (i === selected) {
            borderColor = colors.primary;
            bgColor = colors.primary + '18';
          }

          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { borderColor, backgroundColor: bgColor }]}
              onPress={() => handleSelect(i)}
              disabled={result !== null || submitting}
            >
              <Text style={[styles.optLabel, { color: colors.primary }]}>{label}.</Text>
              <Text style={[styles.optPlaceholder, { color: colors.textMuted }]}>
                Đáp án {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {submitting && (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        )}

        {result && (
          <View style={[styles.resultBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: result.isCorrect ? '#16a34a' : colors.danger, fontWeight: '800', fontSize: 16 }}>
              {result.isCorrect ? '✅ Đúng rồi!' : '❌ Sai rồi!'}
            </Text>
            {result.explanation ? (
              <Text style={[styles.explanation, { color: colors.text }]}>{result.explanation}</Text>
            ) : null}
          </View>
        )}

        {result && (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backBtnText, { color: colors.primaryText }]}>← Về danh sách</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backText: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  question: { fontSize: 16, fontWeight: '600', lineHeight: 26, marginBottom: 4 },
  option: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 8,
  },
  optLabel: { fontSize: 15, fontWeight: '700', minWidth: 20 },
  optPlaceholder: { fontSize: 14 },
  spinner: { marginVertical: 8 },
  resultBox: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  explanation: { fontSize: 14, lineHeight: 21 },
  backBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  backBtnText: { fontWeight: '700', fontSize: 15 },
});
