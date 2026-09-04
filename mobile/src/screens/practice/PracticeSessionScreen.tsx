// Man hinh lam bai on tap — hien thi tung cau hoi + nhan dap an.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { submitPracticeAnswer, completePracticeSession } from '../../api/practice.js';
import { getPracticeSession, clearPracticeSession } from './PracticeHomeScreen.js';
import type { PracticeStackScreenProps } from '../../navigation/types.js';
import type { AnswerResponse, QuestionPublicDto } from '../../api/practice.js';

type Props = PracticeStackScreenProps<'PracticeSession'>;

interface QuestionState {
  answered: boolean;
  selectedOption: number | null;
  result: AnswerResponse | null;
}

export function PracticeSessionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { subjectName } = route.params;

  const session = getPracticeSession();
  const questions: QuestionPublicDto[] = session?.questions ?? [];
  const sessionId = session?.sessionId ?? '';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [states, setStates] = useState<QuestionState[]>(
    questions.map(() => ({ answered: false, selectedOption: null, result: null })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const currentQ = questions[currentIndex];
  const currentState = states[currentIndex];

  const handleSelectOption = useCallback(
    async (optionIndex: number) => {
      if (!sessionToken || !currentQ || currentState?.answered || submitting) return;

      setSubmitting(true);
      try {
        const result = await submitPracticeAnswer(sessionToken, sessionId, currentQ.id, optionIndex);
        if (!isMounted.current) return;
        setStates((prev) =>
          prev.map((s, i) =>
            i === currentIndex
              ? { answered: true, selectedOption: optionIndex, result }
              : s,
          ),
        );
      } catch (err: unknown) {
        if (!isMounted.current) return;
        const msg = err instanceof Error ? err.message : 'Không thể nộp đáp án.';
        Alert.alert('Lỗi', msg);
      } finally {
        if (isMounted.current) setSubmitting(false);
      }
    },
    [sessionToken, currentQ, currentState, submitting, sessionId, currentIndex],
  );

  const handleComplete = useCallback(async () => {
    if (!sessionToken || completing) return;
    setCompleting(true);
    try {
      const result = await completePracticeSession(sessionToken, sessionId);
      clearPracticeSession();
      navigation.replace('PracticeResult', {
        sessionId: result.sessionId,
        score: result.score,
        pointsEarned: result.pointsEarned,
      });
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg = err instanceof Error ? err.message : 'Không thể hoàn thành phiên.';
      Alert.alert('Lỗi', msg);
      setCompleting(false);
    }
  }, [sessionToken, sessionId, navigation, completing]);

  if (!currentQ) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          Không tìm thấy phiên ôn tập. Vui lòng thử lại.
        </Text>
      </View>
    );
  }

  const answeredCount = states.filter((s) => s.answered).length;
  const allAnswered = answeredCount === questions.length;

  const getOptionStyle = (optionIndex: number) => {
    if (!currentState?.answered) return [styles.option, { borderColor: colors.border, backgroundColor: colors.surface }];
    const isCorrect = optionIndex === currentState.result?.correctAnswer;
    const isSelected = optionIndex === currentState.selectedOption;
    if (isCorrect) return [styles.option, { borderColor: '#16a34a', backgroundColor: '#dcfce7' }];
    if (isSelected && !isCorrect) return [styles.option, { borderColor: colors.danger, backgroundColor: '#fee2e2' }];
    return [styles.option, { borderColor: colors.border, backgroundColor: colors.surface }];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Thoát</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{subjectName}</Text>
        <Text style={[styles.progress, { color: colors.textMuted }]}>
          {answeredCount}/{questions.length}
        </Text>
      </View>

      {/* Question navigation dots */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dots}>
        {questions.map((_, i) => {
          const s = states[i];
          const bgColor = i === currentIndex
            ? colors.primary
            : s?.answered
              ? (s.result?.isCorrect ? '#16a34a' : colors.danger)
              : colors.border;
          return (
            <TouchableOpacity key={i} onPress={() => setCurrentIndex(i)} style={[styles.dot, { backgroundColor: bgColor }]}>
              <Text style={styles.dotText}>{i + 1}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Question content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.questionIndex, { color: colors.textMuted }]}>
          Câu {currentIndex + 1}/{questions.length}
        </Text>
        <Text style={[styles.questionText, { color: colors.text }]}>{currentQ.question}</Text>

        {currentQ.options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={getOptionStyle(i)}
            onPress={() => handleSelectOption(i)}
            disabled={currentState?.answered || submitting}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionLabel, { color: colors.primary }]}>
              {['A', 'B', 'C', 'D'][i]}.
            </Text>
            <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
          </TouchableOpacity>
        ))}

        {currentState?.answered && currentState.result?.explanation ? (
          <View style={[styles.explanation, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.explanationTitle, { color: colors.primary }]}>💡 Giải thích</Text>
            <Text style={[styles.explanationText, { color: colors.text }]}>
              {currentState.result.explanation}
            </Text>
          </View>
        ) : null}

        {currentIndex < questions.length - 1 && currentState?.answered ? (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={() => setCurrentIndex((i) => i + 1)}
          >
            <Text style={[styles.nextBtnText, { color: colors.primaryText }]}>Câu tiếp theo →</Text>
          </TouchableOpacity>
        ) : null}

        {allAnswered ? (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: '#16a34a' }]}
            onPress={handleComplete}
            disabled={completing}
          >
            {completing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeBtnText}>✅ Hoàn thành phiên</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 8 },
  backText: { fontSize: 14 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  progress: { fontSize: 13 },
  dots: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 52 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  questionIndex: { fontSize: 13 },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },
  option: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: 8,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', minWidth: 20 },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  explanation: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  explanationTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  explanationText: { fontSize: 14, lineHeight: 21 },
  nextBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  nextBtnText: { fontWeight: '700', fontSize: 15 },
  completeBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { textAlign: 'center', margin: 32, fontSize: 15 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});
