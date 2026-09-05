// Man hinh On cau sai — Premium gate: Free hien thong bao nang cap; Premium hien danh sach cau sai.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { getWrongAnswers, retryWrongAnswer } from '../api/wrongAnswers';
import type { WrongAnswerItem, RetryResult } from '../api/wrongAnswers';
import { SUBJECT_CATALOG } from '../constants/subjects';
import { ApiError } from '../api/client';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

interface Props {
  onBack: () => void;
}

interface RetryState {
  selected: unknown;
  result: RetryResult | null;
  loading: boolean;
}

export function WrongAnswersScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();
  const [items, setItems] = useState<WrongAnswerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremiumBlocked, setIsPremiumBlocked] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [retryStates, setRetryStates] = useState<Record<number, RetryState>>({});

  // isPremium tu profile — dung truc tiep, khong can setState dong bo trong effect
  const isPremium = profile?.isPremium ?? false;

  useEffect(() => {
    if (!sessionToken) return;
    // isPremium = false → tra ve ngay qua Promise.resolve (khong goi setState dong bo)
    if (!isPremium) {
      Promise.resolve()
        .then(() => {
          setLoading(false);
          setIsPremiumBlocked(true);
        })
        .catch(() => {});
      return;
    }
    getWrongAnswers(sessionToken, subjectFilter || undefined, 1, 50)
      .then((res) => { setItems(res.data); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setIsPremiumBlocked(true);
        }
      })
      .finally(() => { setLoading(false); });
  }, [sessionToken, isPremium, subjectFilter]);

  async function handleRetry(item: WrongAnswerItem, answer: unknown) {
    if (!sessionToken) return;
    setRetryStates((prev) => ({ ...prev, [item.id]: { selected: answer, result: null, loading: true } }));
    try {
      const result = await retryWrongAnswer(sessionToken, item.id, answer);
      setRetryStates((prev) => ({ ...prev, [item.id]: { selected: answer, result, loading: false } }));
      if (result.isCorrect) {
        // Xoa khoi danh sach sau khi tra loi dung
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        }, 1500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi câu trả lời.';
      Alert.alert('Lỗi', msg);
      setRetryStates((prev) => ({ ...prev, [item.id]: { selected: null, result: null, loading: false } }));
    }
  }

  function renderRetryQuestion(item: WrongAnswerItem) {
    const state = retryStates[item.id];
    const question = item.question;
    const options = Array.isArray(question.options) ? question.options as string[] : [];
    const correctAnswer = question.correctAnswer;

    if (question.type !== 'MCQ_4' || options.length === 0) {
      return (
        <Text style={[styles.nonMcqNote, { color: colors.textMuted }]}>
          (Câu dạng này không thể ôn trực tiếp trên app — hãy làm lại qua phiên luyện tập)
        </Text>
      );
    }

    return (
      <View style={styles.retryArea}>
        {options.map((opt, idx) => {
          const isSelected = state?.selected === idx;
          const hasResult = !!state?.result;
          const isCorrect = idx === correctAnswer;

          let bgColor = colors.surface;
          let borderColor = colors.border;
          if (hasResult) {
            if (isCorrect) { bgColor = '#16a34a22'; borderColor = '#16a34a'; }
            else if (isSelected) { bgColor = '#dc262622'; borderColor = '#dc2626'; }
          } else if (isSelected) {
            bgColor = colors.primary + '22'; borderColor = colors.primary;
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.retryOption, { backgroundColor: bgColor, borderColor }]}
              onPress={() => { void handleRetry(item, idx); }}
              disabled={hasResult || state?.loading}
            >
              <Text style={[styles.retryLabel, { color: hasResult && isCorrect ? '#16a34a' : colors.text }]}>
                {OPTION_LABELS[idx]}. {opt}
              </Text>
            </TouchableOpacity>
          );
        })}

        {state?.loading && <ActivityIndicator color={colors.primary} />}

        {state?.result && (
          <View style={[styles.retryFeedback, { backgroundColor: state.result.isCorrect ? '#16a34a18' : '#dc262618', borderColor: state.result.isCorrect ? '#16a34a' : '#dc2626' }]}>
            <Text style={{ color: state.result.isCorrect ? '#16a34a' : '#dc2626', fontWeight: '700' }}>
              {state.result.isCorrect ? '✅ Chính xác!' : '❌ Sai. Đáp án: ' + OPTION_LABELS[correctAnswer as number]}
            </Text>
            {state.result.explanation && (
              <Text style={[styles.retryExplain, { color: colors.textMuted }]}>{state.result.explanation}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderItem({ item }: { item: WrongAnswerItem }) {
    const subjectName = SUBJECT_CATALOG.find((s) => s.id === item.question.subjectId)?.name ?? item.question.subjectId;
    return (
      <View style={[styles.waCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.waHeader}>
          <Text style={[styles.waSubject, { color: colors.primary }]}>{subjectName}</Text>
          <Text style={[styles.waExpiry, { color: item.wrongCount >= 3 ? '#dc2626' : colors.textMuted }]}>
            Sai {item.wrongCount}x · còn {daysLeft(item.expiresAt)} ngày
          </Text>
        </View>
        <Text style={[styles.waQuestion, { color: colors.text }]}>{item.question.content}</Text>
        {renderRetryQuestion(item)}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>❌ Ôn câu sai</Text>
      </View>

      {/* Premium gate */}
      {isPremiumBlocked && (
        <View style={styles.gateContainer}>
          <Text style={{ fontSize: 56 }}>🔒</Text>
          <Text style={[styles.gateTitle, { color: colors.text }]}>Tính năng Premium</Text>
          <Text style={[styles.gateBody, { color: colors.textMuted }]}>
            Nâng cấp Premium để xem và ôn lại các câu bạn đã làm sai. Hệ thống tự động lưu câu sai và nhắc bạn ôn lại.
          </Text>
        </View>
      )}

      {/* Filter mon hoc (chi hien khi Premium) */}
      {!isPremiumBlocked && !loading && (
        <View>
          <FlatList
            data={[{ id: '', name: 'Tất cả', emoji: '📚' }, ...SUBJECT_CATALOG]}
            keyExtractor={(s) => s.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            renderItem={({ item: s }) => (
              <TouchableOpacity
                style={[styles.filterChip, {
                  backgroundColor: subjectFilter === s.id ? colors.primary : colors.surface,
                  borderColor: subjectFilter === s.id ? colors.primary : colors.border,
                }]}
                onPress={() => setSubjectFilter(s.id)}
              >
                <Text style={{ color: subjectFilter === s.id ? colors.primaryText : colors.text, fontSize: 13, fontWeight: '600' }}>
                  {s.emoji} {s.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}

      {!loading && !isPremiumBlocked && items.length === 0 && (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>🎉</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Không có câu sai nào!</Text>
        </View>
      )}

      {!loading && !isPremiumBlocked && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  gateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  gateTitle: { fontSize: 20, fontWeight: '800' },
  gateBody: { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, gap: 14 },
  waCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  waHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waSubject: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  waExpiry: { fontSize: 12 },
  waQuestion: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  retryArea: { gap: 8, marginTop: 4 },
  retryOption: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderRadius: 10, padding: 10, gap: 8 },
  retryLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  retryFeedback: { borderWidth: 1.5, borderRadius: 10, padding: 12, gap: 4 },
  retryExplain: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  nonMcqNote: { fontSize: 13, fontStyle: 'italic', marginTop: 4 },
});
