// Man hinh danh sach de thi — hoc sinh chon de de bat dau.
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
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { listExamPapers, startExam, type ExamPaperPublicDto } from '../../api/exam.js';
import type { ExamStackScreenProps } from '../../navigation/types.js';
import { storeExamSession } from './ExamSessionScreen.js';

type Props = ExamStackScreenProps<'ExamList'>;

export function ExamListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [papers, setPapers] = useState<ExamPaperPublicDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listExamPapers(sessionToken)
      .then(res => { if (!cancelled) setPapers(res.data); })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đề thi.';
          Alert.alert('Lỗi', msg);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken]);

  const handleStart = async (paper: ExamPaperPublicDto) => {
    if (!sessionToken) return;
    setStarting(paper.id);
    try {
      const session = await startExam(sessionToken, paper.id);
      storeExamSession(session);
      navigation.navigate('ExamSession', {
        sessionId: session.sessionId,
        examPaperId: session.examPaperId,
        title: session.title,
        durationMinutes: session.durationMinutes,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể bắt đầu bài thi.';
      Alert.alert('Lỗi', msg);
    } finally {
      setStarting(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={styles.emoji}>📝</Text>
        <Text style={[styles.title, { color: colors.text }]}>Thi thử</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Chọn đề để bắt đầu</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : papers.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.textMuted }]}>Chưa có đề thi nào.</Text>
        </View>
      ) : (
        <FlatList
          data={papers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isStarting = starting === item.id;
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleStart(item)}
                disabled={starting !== null}
                activeOpacity={0.75}
              >
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                    {item.subject} · {item.questionCount} câu · {item.durationMinutes} phút
                  </Text>
                </View>
                {isStarting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.startText, { color: colors.primary }]}>Bắt đầu ▶</Text>
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
  header: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  emoji: { fontSize: 40, marginTop: 16, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardMeta: { fontSize: 13 },
  startText: { fontSize: 13, fontWeight: '700' },
});
