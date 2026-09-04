// Man hinh lam bai thi — hien thi tung cau theo scroll, dem thoi gian.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { submitExam, type StartExamResponse, type ExamQuestionPublicDto } from '../../api/exam.js';
import type { ExamStackScreenProps } from '../../navigation/types.js';

type Props = ExamStackScreenProps<'ExamSession'>;

// ---------------------------------------------------------------------------
// Module-level session store (tuong tu practice module)
// ---------------------------------------------------------------------------

let _examSession: StartExamResponse | null = null;

export function storeExamSession(s: StartExamResponse): void {
  _examSession = s;
}
export function getExamSession(): StartExamResponse | null {
  return _examSession;
}
export function clearExamSession(): void {
  _examSession = null;
}

// ---------------------------------------------------------------------------
// Types cho answers
// ---------------------------------------------------------------------------

type ExamAnswer = number | boolean[] | string | null;

/** Dinh dang lai dap an de gui len backend. */
function formatAnswer(
  q: ExamQuestionPublicDto,
  raw: ExamAnswer,
): unknown {
  if (raw === null) return {}; // sentinel "bo trong" cho backend
  if (q.questionType === 'MCQ_4') return raw as number;
  if (q.questionType === 'TRUE_FALSE_4') return raw as boolean[];
  if (q.questionType === 'FILL_BLANK') return raw as string;
  return {};
}

export function ExamSessionScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();
  const { sessionId, durationMinutes } = route.params;

  const session = getExamSession();
  // useMemo de tranh tao mang moi moi render (tranh questions thay doi reference)
  const questions: ExamQuestionPublicDto[] = useMemo(
    () => session?.questions ?? [],
    [session],
  );

  const [answers, setAnswers] = useState<ExamAnswer[]>(questions.map(() => null));
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const isMounted = useRef(true);
  // Ref de timer co the goi handleSubmit ma khong can no trong dependency array
  const handleSubmitRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!sessionToken || submitting) return;
    setSubmitting(true);
    try {
      const submitAnswers = questions.map((q, i) => ({
        examQuestionId: q.id,
        selectedAnswer: formatAnswer(q, answers[i] ?? null),
      }));
      const result = await submitExam(sessionToken, sessionId, submitAnswers);
      clearExamSession();
      navigation.replace('ExamResult', { sessionId: result.sessionId });
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg = err instanceof Error ? err.message : 'Không thể nộp bài.';
      Alert.alert('Lỗi', msg);
      setSubmitting(false);
    }
  }, [sessionToken, submitting, questions, answers, sessionId, navigation]);

  // Cap nhat ref moi khi handleSubmit thay doi
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Dem thoi gian — chi chay 1 lan luc mount, dung ref de tranh stale closure
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          // Nop bai khi het gio
          if (handleSubmitRef.current) handleSubmitRef.current();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // chi chay 1 lan luc mount — dung handleSubmitRef.current de tranh stale closure

  const minutes = Math.floor(Math.max(0, timeLeft) / 60);
  const seconds = Math.max(0, timeLeft) % 60;
  const timerColor = timeLeft < 120 ? colors.danger : colors.text;

  const setMcqAnswer = (idx: number, opt: number) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? opt : a)));
  };

  const setTfAnswer = (qIdx: number, boolIdx: number, val: boolean) => {
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (i !== qIdx) return a;
        const arr = Array.isArray(a) ? [...(a as boolean[])] : [false, false, false, false];
        arr[boolIdx] = val;
        return arr;
      }),
    );
  };

  const setFillAnswer = (idx: number, text: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? text : a)));
  };

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>Không tìm thấy phiên thi.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Timer header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{session.title}</Text>
        <Text style={[styles.timer, { color: timerColor }]}>
          ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {questions.map((q, qIdx) => {
          const ans = answers[qIdx];

          return (
            <View key={q.id} style={[styles.qCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.qIndex, { color: colors.textMuted }]}>Câu {qIdx + 1}</Text>
              <Text style={[styles.qText, { color: colors.text }]}>{q.questionText}</Text>

              {/* MCQ_4 */}
              {q.questionType === 'MCQ_4' && q.options && q.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.option,
                    {
                      borderColor: ans === i ? colors.primary : colors.border,
                      backgroundColor: ans === i ? (colors.primary + '18') : colors.background,
                    },
                  ]}
                  onPress={() => setMcqAnswer(qIdx, i)}
                >
                  <Text style={[styles.optLabel, { color: colors.primary }]}>{['A', 'B', 'C', 'D'][i]}.</Text>
                  <Text style={[styles.optText, { color: colors.text }]}>{opt}</Text>
                </TouchableOpacity>
              ))}

              {/* TRUE_FALSE_4 */}
              {q.questionType === 'TRUE_FALSE_4' && q.options && q.options.map((opt, i) => {
                const tfArr = Array.isArray(ans) ? (ans as boolean[]) : [false, false, false, false];
                const selected = tfArr[i] === true;
                return (
                  <View key={i} style={styles.tfRow}>
                    <Text style={[styles.tfOpt, { color: colors.text, flex: 1 }]}>{opt}</Text>
                    <TouchableOpacity
                      style={[styles.tfBtn, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}
                      onPress={() => setTfAnswer(qIdx, i, !selected)}
                    >
                      <Text style={{ color: selected ? colors.primaryText : colors.textMuted, fontWeight: '700' }}>
                        {selected ? 'Đ' : '?'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* FILL_BLANK */}
              {q.questionType === 'FILL_BLANK' && (
                <TextInput
                  style={[styles.fillInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                  placeholder="Nhập đáp án..."
                  placeholderTextColor={colors.textMuted}
                  value={typeof ans === 'string' ? ans : ''}
                  onChangeText={(t) => setFillAnswer(qIdx, t)}
                />
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryText }]}>Nộp bài</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  timer: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  scroll: { padding: 16, gap: 12 },
  qCard: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 10 },
  qIndex: { fontSize: 12 },
  qText: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  option: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: 6,
  },
  optLabel: { fontWeight: '700', fontSize: 14, minWidth: 18 },
  optText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tfRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  tfOpt: { fontSize: 14 },
  tfBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitText: { fontWeight: '800', fontSize: 16 },
  error: { textAlign: 'center', margin: 32, fontSize: 15 },
});
