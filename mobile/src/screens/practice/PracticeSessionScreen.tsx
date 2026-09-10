// Man hinh Phien luyen tap — hien tung cau hoi, cho nguoi dung chon dap an,
// goi API answer sau moi cau, sau do goi complete khi xong tat ca.
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { answerQuestion, completeSession } from '../../api/practice';
import type { AnswerResult, CompleteResult } from '../../api/practice';
import type { PracticeStackScreenProps } from '../../navigation/types';

type Props = PracticeStackScreenProps<'PracticeSession'>;

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

type QuestionState = 'unanswered' | 'answered';

export function PracticeSessionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const { session } = route.params;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [questionState, setQuestionState] = useState<QuestionState>('unanswered');
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  // Dung timeLimitSeconds tu server (1020s = 17 phut), khong hardcode 30 phut
  const [timeRemaining, setTimeRemaining] = useState(session.timeLimitSeconds);
  // Modal ket qua sau khi ket thuc som
  const [resultModal, setResultModal] = useState<CompleteResult | null>(null);

  const currentQ = session.questions[questionIndex];
  const isLastQ = questionIndex === session.questions.length - 1;

  /**
   * Tự động hoàn thành phiên luyện tập khi hết 30 phút.
   * Dùng useCallback để tránh lỗi "accessed before declaration" khi dùng trong useEffect phía sau.
   */
  const handleAutoComplete = useCallback(async () => {
    if (!sessionToken) return;
    setFinishing(true);
    try {
      const complete = await completeSession(sessionToken, session.sessionId);
      navigation.replace('PracticeResult', {
        complete,
        subject: session.subject,
        totalQuestions: session.questions.length,
        correctCount,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể hoàn tất phiên.';
      Alert.alert('Lỗi', msg);
      setFinishing(false);
    }
  }, [sessionToken, session, navigation, correctCount]);

  // Timer đếm ngược theo timeLimitSeconds từ server — auto-complete khi về 0
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Auto-complete khi hết thời gian.
      // handleAutoComplete là async — setState bên trong nó chạy sau await,
      // không synchronous trong effect, nên disable rule này là hợp lệ.
      if (!finishing && !submitting) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void handleAutoComplete();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, finishing, submitting, handleAutoComplete]);

  async function handleSelectOption(optionIdx: number) {
    if (questionState === 'answered' || !sessionToken) return;
    setSelected(optionIdx);
    setSubmitting(true);
    try {
      const ans = await answerQuestion(sessionToken, session.sessionId, currentQ.id, optionIdx);
      setResult(ans);
      setQuestionState('answered');
      if (ans.isCorrect) setCorrectCount((c) => c + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi câu trả lời.';
      Alert.alert('Lỗi', msg);
      setSelected(null);
    } finally {
      setSubmitting(false);
    }
  }

  // Ket thuc som: goi complete ngay, hien modal ket qua (khong navigate ngay)
  async function handleEarlyComplete() {
    if (!sessionToken) return;
    setFinishing(true);
    try {
      const complete = await completeSession(sessionToken, session.sessionId);
      setResultModal(complete);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể kết thúc phiên.';
      Alert.alert('Lỗi', msg);
    } finally {
      setFinishing(false);
    }
  }

  // Xac nhan thoat — canh bao mat ket qua neu chua complete
  function handleExitPress() {
    Alert.alert(
      'Thoát phiên luyện tập?',
      'Thoát ngay sẽ không lưu kết quả. Bạn muốn tiếp tục?',
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Thoát', style: 'destructive', onPress: () => navigation.goBack() },
      ],
    );
  }

  async function handleNext() {
    if (!sessionToken) return;
    if (isLastQ) {
      // Hoan tat phien
      setFinishing(true);
      try {
        const complete = await completeSession(sessionToken, session.sessionId);
        navigation.replace('PracticeResult', {
          complete,
          subject: session.subject,
          totalQuestions: session.questions.length,
          correctCount,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể hoàn tất phiên.';
        Alert.alert('Lỗi', msg);
        setFinishing(false);
      }
    } else {
      // Sang cau tiep theo
      setQuestionIndex((i) => i + 1);
      setSelected(null);
      setResult(null);
      setQuestionState('unanswered');
    }
  }

  function getOptionStyle(idx: number) {
    if (questionState === 'unanswered') {
      return [
        styles.option,
        { backgroundColor: colors.surface, borderColor: selected === idx ? colors.primary : colors.border },
      ];
    }
    // Da tra loi
    if (idx === result?.correctAnswer) {
      return [styles.option, { backgroundColor: '#16a34a22', borderColor: '#16a34a' }];
    }
    if (idx === selected && !result?.isCorrect) {
      return [styles.option, { backgroundColor: '#dc262622', borderColor: '#dc2626' }];
    }
    return [styles.option, { backgroundColor: colors.surface, borderColor: colors.border }];
  }

  function getOptionTextColor(idx: number): string {
    if (questionState === 'answered') {
      if (idx === result?.correctAnswer) return '#16a34a';
      if (idx === selected && !result?.isCorrect) return '#dc2626';
    }
    return colors.text;
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Modal ket qua sau khi ket thuc som */}
      <Modal
        visible={resultModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🎯 Kết quả phiên luyện tập</Text>
            <Text style={[styles.modalScore, { color: colors.primary }]}>
              {correctCount}/{session.questions.length} câu đúng
            </Text>
            {resultModal && (
              <Text style={[styles.modalPoints, { color: '#f59e0b' }]}>+{resultModal.pointsEarned} điểm</Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setResultModal(null);
                  navigation.replace('PracticeResult', {
                    complete: resultModal!,
                    subject: session.subject,
                    totalQuestions: session.questions.length,
                    correctCount,
                  });
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Xem chi tiết</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleExitPress} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Thoát</Text>
        </TouchableOpacity>
        <View style={styles.headerCenterContainer}>
          <Text style={[styles.progress, { color: colors.textMuted }]}>
            Câu {questionIndex + 1}/{session.questions.length}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.timerContainer, { backgroundColor: timeRemaining <= 60 ? '#dc262618' : 'transparent' }]}>
            <Text style={[styles.timerText, { color: timeRemaining <= 60 ? '#dc2626' : colors.textMuted }]}>
              ⏱ {formatTime(timeRemaining)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.earlyEndBtn, { borderColor: colors.border }]}
            onPress={() => { void handleEarlyComplete(); }}
            disabled={finishing || submitting || questionState === 'unanswered'}
          >
            {finishing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.earlyEndText, { color: colors.primary }]}>Kết thúc sớm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Thanh tien do */}
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${((questionIndex + (questionState === 'answered' ? 1 : 0)) / session.questions.length) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Cau hoi */}
        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.difficulty, { color: colors.textMuted }]}>
            {'⭐'.repeat(currentQ.difficulty)} Độ khó {currentQ.difficulty}
          </Text>
          <Text style={[styles.questionText, { color: colors.text }]}>{currentQ.question}</Text>
        </View>

        {/* Cac lua chon */}
        {currentQ.options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={getOptionStyle(idx)}
            onPress={() => { void handleSelectOption(idx); }}
            disabled={questionState === 'answered' || submitting}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionLabel, { color: getOptionTextColor(idx) }]}>
              {OPTION_LABELS[idx]}.
            </Text>
            <Text style={[styles.optionText, { color: getOptionTextColor(idx) }]}>{opt}</Text>
          </TouchableOpacity>
        ))}

        {submitting && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}

        {/* Giai thich + nut tiep theo */}
        {questionState === 'answered' && (
          <View style={styles.feedbackArea}>
            <View style={[styles.feedbackCard, { backgroundColor: result?.isCorrect ? '#16a34a18' : '#dc262618', borderColor: result?.isCorrect ? '#16a34a' : '#dc2626' }]}>
              <Text style={{ color: result?.isCorrect ? '#16a34a' : '#dc2626', fontWeight: '700', fontSize: 15 }}>
                {result?.isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng'}
              </Text>
              {result?.explanation && (
                <Text style={[styles.explanation, { color: colors.textMuted }]}>{result.explanation}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
              onPress={() => { void handleNext(); }}
              disabled={finishing}
            >
              {finishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>{isLastQ ? 'Xem kết quả' : 'Câu tiếp theo →'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  backBtn: { padding: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerCenterContainer: { flex: 1, alignItems: 'center' },
  progress: { fontSize: 14, fontWeight: '600' },
  timerContainer: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timerText: { fontSize: 14, fontWeight: '600' },
  content: { padding: 20, gap: 12 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  questionCard: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  difficulty: { fontSize: 12 },
  questionText: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', minWidth: 20 },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  feedbackArea: { gap: 12, marginTop: 4 },
  feedbackCard: { borderWidth: 1.5, borderRadius: 12, padding: 14, gap: 8 },
  explanation: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  nextBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earlyEndBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  earlyEndText: { fontSize: 12, fontWeight: '600' },
  // Modal ket qua ket thuc som
  modalOverlay: { flex: 1, backgroundColor: '#00000060', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 20, padding: 24, width: '100%', alignItems: 'center', gap: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalScore: { fontSize: 36, fontWeight: '900' },
  modalPoints: { fontSize: 20, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  modalBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
  modalBtnPrimary: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
