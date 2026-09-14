// Man hinh form gui cau hoi moi — hoc sinh nhap noi dung cau hoi.
// Ho tro dang MCQ_4 (4 lua chon) va FILL_BLANK (dien vao cho trong).
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { useAppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import { createSubmission, type ExamQuestionType } from '../../api/questionSubmission';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { ProfileStackScreenProps } from '../../navigation/types';

type Props = ProfileStackScreenProps<'QuestionSubmissionForm'>;

export function QuestionSubmissionFormScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [subject, setSubject] = useState('');
  const [questionType, setQuestionType] = useState<ExamQuestionType>('MCQ_4');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!sessionToken) return;

    // Validate
    if (!subject) {
      Alert.alert('Lỗi', 'Vui lòng chọn môn học.');
      return;
    }
    if (questionText.trim().length < 5) {
      Alert.alert('Lỗi', 'Câu hỏi phải có ít nhất 5 ký tự.');
      return;
    }
    if (questionType === 'MCQ_4') {
      if (options.some((o) => !o.trim())) {
        Alert.alert('Lỗi', 'Vui lòng nhập đủ 4 lựa chọn.');
        return;
      }
      if (correctIndex === null) {
        Alert.alert('Lỗi', 'Vui lòng chọn đáp án đúng.');
        return;
      }
    } else if (questionType === 'FILL_BLANK') {
      if (!fillAnswer.trim()) {
        Alert.alert('Lỗi', 'Vui lòng nhập đáp án.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createSubmission(sessionToken, {
        subject,
        questionType,
        questionText: questionText.trim(),
        options: questionType === 'MCQ_4' ? options.map((o) => o.trim()) : undefined,
        correctAnswer:
          questionType === 'MCQ_4'
            ? (correctIndex as number)
            : [fillAnswer.trim()],
      });
      Alert.alert('Thành công', 'Câu hỏi của bạn đã được gửi! Chờ admin duyệt.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gửi câu hỏi.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Gửi câu hỏi</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Mon hoc */}
        <Text style={[styles.label, { color: colors.text }]}>Môn học *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar}>
          {SUBJECT_CATALOG.map((s) => {
            const active = s.id === subject;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setSubject(s.id)}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                  {s.emoji} {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Dang cau hoi */}
        <Text style={[styles.label, { color: colors.text }]}>Dạng câu hỏi *</Text>
        <View style={styles.typeRow}>
          {(['MCQ_4', 'FILL_BLANK'] as ExamQuestionType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, { backgroundColor: questionType === t ? colors.primary : colors.surface, borderColor: questionType === t ? colors.primary : colors.border }]}
              onPress={() => setQuestionType(t)}
            >
              <Text style={{ color: questionType === t ? colors.primaryText : colors.text, fontWeight: '600', fontSize: 13 }}>
                {t === 'MCQ_4' ? '4 lựa chọn' : 'Điền vào chỗ trống'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Noi dung cau hoi */}
        <Text style={[styles.label, { color: colors.text }]}>Nội dung câu hỏi *</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          multiline
          numberOfLines={4}
          placeholder="Nhập nội dung câu hỏi..."
          placeholderTextColor={colors.textMuted}
          value={questionText}
          onChangeText={setQuestionText}
          textAlignVertical="top"
        />

        {/* MCQ options */}
        {questionType === 'MCQ_4' && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>4 lựa chọn *</Text>
            {options.map((opt, i) => (
              <View key={i} style={styles.optionRow}>
                <TouchableOpacity
                  style={[styles.radioBtn, { borderColor: correctIndex === i ? colors.primary : colors.border, backgroundColor: correctIndex === i ? colors.primary : 'transparent' }]}
                  onPress={() => setCorrectIndex(i)}
                >
                  <Text style={{ color: correctIndex === i ? colors.primaryText : colors.textMuted, fontSize: 12 }}>✓</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.optInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface, flex: 1 }]}
                  placeholder={`Lựa chọn ${['A', 'B', 'C', 'D'][i]}`}
                  placeholderTextColor={colors.textMuted}
                  value={opt}
                  onChangeText={(t) => setOptions((prev) => prev.map((o, j) => (j === i ? t : o)))}
                />
              </View>
            ))}
            {correctIndex !== null && (
              <Text style={[styles.hint, { color: colors.primary }]}>✓ Đáp án đúng: {['A', 'B', 'C', 'D'][correctIndex]}</Text>
            )}
          </>
        )}

        {/* FILL_BLANK answer */}
        {questionType === 'FILL_BLANK' && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Đáp án đúng *</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              placeholder="Nhập đáp án..."
              placeholderTextColor={colors.textMuted}
              value={fillAnswer}
              onChangeText={setFillAnswer}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryText }]}>📤 Gửi câu hỏi</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.limit, { color: colors.textMuted }]}>
          Giới hạn 5 câu/ngày. Câu được duyệt thưởng 30 điểm.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  backText: { fontSize: 20 },
  title: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: 16, gap: 12 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  chipBar: { maxHeight: 48, marginVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  hint: { fontSize: 13, fontWeight: '600' },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitText: { fontWeight: '700', fontSize: 16 },
  limit: { fontSize: 12, textAlign: 'center', paddingBottom: 8 },
});
