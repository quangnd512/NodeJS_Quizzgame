// Man hinh chon mon hoc de bat dau phien on tap.
// Hien thi danh sach mon hoc da dang ky cua user (lay tu AuthContext).
import React, { useState } from 'react';
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
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { startPracticeSession } from '../../api/practice.js';
import { SUBJECT_CATALOG } from '../../constants/subjects.js';
import type { PracticeStackScreenProps } from '../../navigation/types.js';

type Props = PracticeStackScreenProps<'PracticeHome'>;

export function PracticeHomeScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<string | null>(null); // subjectId dang load

  const userSubjectIds = profile?.subjects?.map((s) => s.id) ?? [];
  const availableSubjects = SUBJECT_CATALOG.filter((s) => userSubjectIds.includes(s.id));

  const handleStart = async (subjectId: string, subjectName: string) => {
    if (!sessionToken) return;
    setLoading(subjectId);
    try {
      const session = await startPracticeSession(sessionToken, subjectId);
      navigation.navigate('PracticeSession', {
        subjectId,
        subjectName,
      });
      // Truyen session qua global state thay vi params de tranh loi khi params lon
      // Luu tam vao module-level var (don gian cho Mobile Stage 1)
      storePracticeSession(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu phiên ôn tập.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.emoji]}>✏️</Text>
        <Text style={[styles.title, { color: colors.text }]}>Luyện tập</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Chọn môn để bắt đầu</Text>
      </View>

      {availableSubjects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Bạn chưa đăng ký môn học nào.
          </Text>
        </View>
      ) : (
        <FlatList
          data={availableSubjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isLoading = loading === item.id;
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleStart(item.id, item.name)}
                disabled={loading !== null}
                activeOpacity={0.7}
              >
                <Text style={styles.cardEmoji}>{item.emoji}</Text>
                <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.cardArrow, { color: colors.primary }]}>▶</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, alignItems: 'center' },
  emoji: { fontSize: 40, marginTop: 16, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardEmoji: { fontSize: 28, marginRight: 12 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '600' },
  cardArrow: { fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },
});

// ---------------------------------------------------------------------------
// Module-level session store (don gian, khong dung Redux/Context rieng).
// Dung cho Mobile Stage 1 — co the nang cap sau.
// ---------------------------------------------------------------------------
import type { StartSessionResponse } from '../../api/practice.js';

let _currentSession: StartSessionResponse | null = null;

export function storePracticeSession(s: StartSessionResponse): void {
  _currentSession = s;
}

export function getPracticeSession(): StartSessionResponse | null {
  return _currentSession;
}

export function clearPracticeSession(): void {
  _currentSession = null;
}
