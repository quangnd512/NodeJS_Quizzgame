// Man hinh danh sach cau sai — hoc sinh xem cac cau sai va bat dau on luyen.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import { useAuth } from '../../auth/AuthContext.js';
import { getWrongAnswers, type WrongAnswerListItem } from '../../api/wrongAnswer.js';
import type { ProgressStackScreenProps } from '../../navigation/types.js';

type Props = ProgressStackScreenProps<'WrongAnswerList'>;

export function WrongAnswerListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<WrongAnswerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await getWrongAnswers(sessionToken);
      setItems(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>📚 Ôn câu sai</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.okEmoji}>✅</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Không có câu sai nào. Tiếp tục phát huy!
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() =>
                navigation.navigate('WrongAnswerSession', {
                  id: item.id,
                  questionContent: item.question.content,
                  subjectId: item.question.subjectId,
                })
              }
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.subject, { color: colors.primary }]}>
                  {item.question.subjectId}
                </Text>
                <Text style={[styles.wrongCount, { color: colors.danger }]}>
                  ✗ {item.wrongCount} lần
                </Text>
              </View>
              <Text style={[styles.questionText, { color: colors.text }]} numberOfLines={2}>
                {item.question.content}
              </Text>
              <Text style={[styles.source, { color: colors.textMuted }]}>
                Nguồn: {item.source === 'practice' ? 'Luyện tập' : 'Thi thử'}
              </Text>
            </TouchableOpacity>
          )}
        />
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 20 },
  title: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  okEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  list: { padding: 16, gap: 12 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subject: { fontSize: 12, fontWeight: '700' },
  wrongCount: { fontSize: 12, fontWeight: '700' },
  questionText: { fontSize: 14, lineHeight: 20 },
  source: { fontSize: 11 },
});
