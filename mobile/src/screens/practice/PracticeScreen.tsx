// Man hinh Luyen tap — chon mon hoc de bat dau phien luyen tap.
// Hien danh sach mon hoc nguoi dung da chon (tu profile), cho phep chon 1 mon roi
// dieu huong sang PracticeSessionScreen.
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
import { useAuth } from '../../auth/AuthContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { startPracticeSession } from '../../api/practice';
import { SUBJECT_CATALOG } from '../../constants/subjects';
import type { PracticeStackScreenProps } from '../../navigation/types';

type Props = PracticeStackScreenProps<'PracticeHome'>;

export function PracticeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile, sessionToken } = useAuth();
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);

  // Chi hien mon hoc nguoi dung da chon khi onboarding
  const mySubjects = SUBJECT_CATALOG.filter(
    (s) => profile?.subjects.some((ps) => ps.id === s.id),
  );

  async function handleStart(subjectId: string) {
    if (!sessionToken) return;
    setLoadingSubject(subjectId);
    try {
      const result = await startPracticeSession(sessionToken, subjectId);
      navigation.navigate('PracticeSession', { session: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu luyện tập.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoadingSubject(null);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: colors.text }]}>✏️ Luyện tập</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Chọn môn để bắt đầu phiên luyện tập ngẫu nhiên (10 câu)
      </Text>

      {mySubjects.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Bạn chưa chọn môn học. Vào Hồ sơ → chỉnh sửa môn học để chọn.
          </Text>
        </View>
      ) : (
        mySubjects.map((s) => {
          const isLoading = loadingSubject === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { void handleStart(s.id); }}
              disabled={loadingSubject !== null}
              activeOpacity={0.75}
            >
              <Text style={styles.emoji}>{s.emoji}</Text>
              <View style={styles.subjectInfo}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{s.name}</Text>
                <Text style={[styles.subjectHint, { color: colors.textMuted }]}>10 câu ngẫu nhiên</Text>
              </View>
              {isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.arrow, { color: colors.primary }]}>›</Text>
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 8 },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 20 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  emoji: { fontSize: 28 },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 16, fontWeight: '700' },
  subjectHint: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 24, fontWeight: '300' },
});
