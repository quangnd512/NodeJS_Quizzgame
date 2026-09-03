// Man hinh Onboarding - chon mon hoc cho user MOI (TASK 7). Chi hien khi AuthContext.status ===
// 'onboarding' (subjects rong) - RootNavigator dam bao dieu do, user cu da co mon se KHONG bao gio
// thay man hinh nay.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { MAX_SUBJECTS, MIN_SUBJECTS, SUBJECT_CATALOG } from '../constants/subjects';

export function OnboardingSubjectsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, lastError } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SUBJECTS) {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size < MIN_SUBJECTS) return;
    setLocalError(null);
    setSubmitting(true);
    try {
      const chosen = SUBJECT_CATALOG.filter((s) => selectedIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
      await completeOnboarding(chosen);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Không thể lưu môn học, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const count = selectedIds.size;
  const atMax = count >= MAX_SUBJECTS;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Chọn môn học bạn muốn ôn thi</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Chọn từ {MIN_SUBJECTS} đến {MAX_SUBJECTS} môn — {count}/{MAX_SUBJECTS} môn đã chọn
      </Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {SUBJECT_CATALOG.map((subject) => {
          const isSelected = selectedIds.has(subject.id);
          const isDisabled = !isSelected && atMax;
          return (
            <Pressable
              key={subject.id}
              onPress={() => toggle(subject.id)}
              disabled={isDisabled}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: isDisabled ? 0.4 : 1,
                },
              ]}
            >
              <Text style={styles.cardEmoji}>{subject.emoji}</Text>
              <Text style={[styles.cardLabel, { color: isSelected ? colors.primaryText : colors.text }]}>
                {subject.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {(localError ?? lastError) ? (
        <Text style={[styles.error, { color: colors.danger }]}>{localError ?? lastError}</Text>
      ) : null}

      <View style={styles.footer}>
        <PrimaryButton
          title="Tiếp tục"
          onPress={handleSubmit}
          loading={submitting}
          disabled={count < MIN_SUBJECTS || submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 16 },
  card: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  cardEmoji: { fontSize: 28 },
  cardLabel: { fontSize: 15, fontWeight: '600' },
  error: { fontSize: 13, marginBottom: 8 },
  footer: { paddingBottom: 24, paddingTop: 8 },
});
