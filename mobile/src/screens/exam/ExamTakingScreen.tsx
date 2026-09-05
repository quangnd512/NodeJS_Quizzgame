// Man hinh Lam bai thi — diem giờ nguoc, hien tung cau hoi theo loai
// (MCQ_4, TRUE_FALSE_4, FILL_BLANK), cho phep chuyen qua lai, nop bai.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { submitExam } from '../../api/exam';
import type { ExamAnswerValue, ExamQuestionType } from '../../api/exam';
import type { ExamStackScreenProps } from '../../navigation/types';

type Props = ExamStackScreenProps<'ExamTaking'>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const TF_LABELS = ['Đúng', 'Sai'];

// Bieu dien "chua tra loi" cho tung loai cau
function emptyAnswer(type: ExamQuestionType): ExamAnswerValue {
  if (type === 'MCQ_4') return -1;        // -1 = chua chon
  if (type === 'TRUE_FALSE_4') return [null, null, null, null];
  return '';  // FILL_BLANK
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamTakingScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const { session } = route.params;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswerValue[]>(
    session.questions.map((q) => emptyAnswer(q.questionType)),
  );
  const [timeLeft, setTimeLeft] = useState(session.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = session.questions[currentIdx];

  // Nop bai thuc su (khong hoi lai) — tach ra de avoid circular ref trong useCallback
  const doSubmit = useCallback(
    async (currentAnswers: ExamAnswerValue[]) => {
      if (!sessionToken) return;
      if (timerRef.current) clearInterval(timerRef.current);
      setSubmitting(true);

      const formattedAnswers = session.questions.map((q, i) => {
        let val: unknown = currentAnswers[i];
        if (q.questionType === 'MCQ_4' && (val as number) === -1) val = {};
        if (q.questionType === 'FILL_BLANK' && (val as string).trim() === '') val = {};
        return { examQuestionId: q.id, selectedAnswer: val };
      });

      try {
        const result = await submitExam(sessionToken, session.sessionId, formattedAnswers);
        navigation.replace('ExamResult', { sessionId: result.sessionId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể nộp bài.';
        Alert.alert('Lỗi', msg);
        setSubmitting(false);
      }
    },
    [sessionToken, session, navigation],
  );

  // Kiem tra truoc khi nop — hoi neu con cau chua tra loi
  const handleSubmit = useCallback(
    (forced: boolean, currentAnswers: ExamAnswerValue[]) => {
      if (forced) {
        void doSubmit(currentAnswers);
        return;
      }
      const unanswered = currentAnswers.filter((a, i) => {
        const q = session.questions[i];
        if (q.questionType === 'MCQ_4') return (a as number) === -1;
        if (q.questionType === 'TRUE_FALSE_4') return (a as (boolean | null)[]).some((v) => v === null);
        return (a as string).trim() === '';
      }).length;

      if (unanswered > 0) {
        Alert.alert(
          'Còn câu chưa trả lời',
          `Còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài không?`,
          [
            { text: 'Xem lại', style: 'cancel' },
            { text: 'Nộp ngay', onPress: () => { void doSubmit(currentAnswers); } },
          ],
        );
        return;
      }
      void doSubmit(currentAnswers);
    },
    [doSubmit, session.questions],
  );

  // Luu answers vao ref de timer co the truy cap gia tri hien tai (tranh stale closure)
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Dem gio nguoc
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit(true, answersRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleSubmit]);

  function setAnswer(idx: number, value: ExamAnswerValue) {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function renderQuestion() {
    const ans = answers[currentIdx];

    if (currentQ.questionType === 'MCQ_4') {
      const selected = ans as number;
      return (
        <View style={styles.optionsArea}>
          {(currentQ.options ?? []).map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.option,
                {
                  backgroundColor: selected === idx ? colors.primary + '22' : colors.surface,
                  borderColor: selected === idx ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAnswer(currentIdx, idx)}
            >
              <Text style={[styles.optionLabel, { color: selected === idx ? colors.primary : colors.text }]}>
                {OPTION_LABELS[idx]}.
              </Text>
              <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (currentQ.questionType === 'TRUE_FALSE_4') {
      const tfAns = ans as (boolean | null)[];
      const statements = currentQ.options ?? [];
      return (
        <View style={styles.optionsArea}>
          {statements.map((stmt, stmtIdx) => (
            <View key={stmtIdx} style={[styles.tfRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tfStmt, { color: colors.text }]}>{String.fromCharCode(65 + stmtIdx)}. {stmt}</Text>
              <View style={styles.tfBtns}>
                {TF_LABELS.map((label, valIdx) => {
                  const isTrue = valIdx === 0;
                  const isSelected = tfAns[stmtIdx] === isTrue;
                  return (
                    <TouchableOpacity
                      key={valIdx}
                      style={[
                        styles.tfBtn,
                        {
                          backgroundColor: isSelected ? (isTrue ? '#16a34a' : '#dc2626') : colors.surface,
                          borderColor: isSelected ? (isTrue ? '#16a34a' : '#dc2626') : colors.border,
                        },
                      ]}
                      onPress={() => {
                        const newTf = [...tfAns] as (boolean | null)[];
                        newTf[stmtIdx] = isTrue;
                        setAnswer(currentIdx, newTf);
                      }}
                    >
                      <Text style={{ color: isSelected ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      );
    }

    // FILL_BLANK
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TextInput
          style={[styles.fillInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Nhập đáp án..."
          placeholderTextColor={colors.textMuted}
          value={ans as string}
          onChangeText={(t) => setAnswer(currentIdx, t)}
          multiline
        />
      </KeyboardAvoidingView>
    );
  }

  const answeredCount = answers.filter((a, i) => {
    const q = session.questions[i];
    if (q.questionType === 'MCQ_4') return (a as number) !== -1;
    if (q.questionType === 'TRUE_FALSE_4') return (a as (boolean | null)[]).some((v) => v !== null);
    return (a as string).trim() !== '';
  }).length;

  const timerColor = timeLeft < 300 ? '#dc2626' : colors.text;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{session.title}</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            {answeredCount}/{session.questions.length} câu đã trả lời
          </Text>
        </View>
        <View style={styles.timerBox}>
          <Text style={[styles.timer, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Chi bao cau */}
        <View style={styles.questionNav}>
          {session.questions.map((_, idx) => {
            const q = session.questions[idx];
            const hasAns = (() => {
              const a = answers[idx];
              if (q.questionType === 'MCQ_4') return (a as number) !== -1;
              if (q.questionType === 'TRUE_FALSE_4') return (a as (boolean | null)[]).some((v) => v !== null);
              return (a as string).trim() !== '';
            })();
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.qNavDot,
                  {
                    backgroundColor: currentIdx === idx ? colors.primary : hasAns ? colors.primary + '50' : colors.surface,
                    borderColor: currentIdx === idx ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCurrentIdx(idx)}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: currentIdx === idx ? colors.primaryText : colors.text }}>
                  {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Noi dung cau */}
        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.qType, { color: colors.textMuted }]}>
            Câu {currentIdx + 1}/{session.questions.length} ·{' '}
            {currentQ.questionType === 'MCQ_4' ? 'Chọn 1 đáp án' : currentQ.questionType === 'TRUE_FALSE_4' ? 'Đúng/Sai' : 'Điền chỗ trống'}{' '}
            · {currentQ.points} điểm
          </Text>
          <Text style={[styles.questionText, { color: colors.text }]}>{currentQ.questionText}</Text>
        </View>

        {renderQuestion()}

        {/* Nut prev/next/nop */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
          >
            <Text style={[styles.navBtnText, { color: colors.text }]}>← Trước</Text>
          </TouchableOpacity>

          {currentIdx < session.questions.length - 1 ? (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: colors.primary }]}
              onPress={() => setCurrentIdx((i) => Math.min(session.questions.length - 1, i + 1))}
            >
              <Text style={[styles.navBtnText, { color: colors.primaryText }]}>Tiếp →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: '#16a34a' }]}
              onPress={() => { handleSubmit(false, answers); }}
              disabled={submitting}
            >
              <Text style={[styles.navBtnText, { color: '#fff' }]}>✓ Nộp bài</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  timerBox: { alignItems: 'center' },
  timer: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  content: { padding: 16, gap: 14 },
  questionNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qNavDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  questionCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  qType: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 15, fontWeight: '600', lineHeight: 24 },
  optionsArea: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 10 },
  optionLabel: { fontSize: 14, fontWeight: '700', minWidth: 20 },
  optionText: { flex: 1, fontSize: 14, lineHeight: 22 },
  tfRow: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  tfStmt: { fontSize: 14, lineHeight: 20 },
  tfBtns: { flexDirection: 'row', gap: 8 },
  tfBtn: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  fillInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 80 },
  navRow: { flexDirection: 'row', gap: 10 },
  navBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  navBtnText: { fontSize: 15, fontWeight: '700' },
});
