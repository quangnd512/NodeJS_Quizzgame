// Man hinh danh sach cau hoi hoc sinh da gui — xem trang thai duyet.
import React, { useEffect, useState } from 'react';
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
import { listMySubmissions, type SubmissionDto } from '../../api/questionSubmission.js';
import type { ProfileStackScreenProps } from '../../navigation/types.js';

type Props = ProfileStackScreenProps<'QuestionSubmissionList'>;

const STATUS_LABEL: Record<string, string> = {
  PENDING: '⏳ Chờ duyệt',
  APPROVED: '✅ Đã duyệt',
  REJECTED: '❌ Bị từ chối',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#d97706',
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
};

export function QuestionSubmissionListScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const { sessionToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SubmissionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listMySubmissions(sessionToken)
      .then(res => { if (!cancelled) setItems(res.data); })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionToken]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>💡 Câu hỏi đã gửi</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('QuestionSubmissionForm')}
        >
          <Text style={[styles.addBtnText, { color: colors.primaryText }]}>+ Gửi mới</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>💡</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Bạn chưa gửi câu hỏi nào.
          </Text>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('QuestionSubmissionForm')}
          >
            <Text style={[styles.sendBtnText, { color: colors.primaryText }]}>Gửi câu hỏi đầu tiên</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.subject, { color: colors.primary }]}>{item.subject}</Text>
                <Text style={[styles.status, { color: STATUS_COLOR[item.status] ?? colors.textMuted }]}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
              <Text style={[styles.questionText, { color: colors.text }]} numberOfLines={2}>
                {item.questionText}
              </Text>
              {item.adminNote ? (
                <Text style={[styles.adminNote, { color: colors.textMuted }]}>
                  Ghi chú: {item.adminNote}
                </Text>
              ) : null}
              {item.status === 'APPROVED' && (
                <Text style={[styles.points, { color: colors.primary }]}>
                  +{item.usagePointsEarned}/{100} điểm từ {item.usageCount} lần dùng
                </Text>
              )}
            </View>
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
  backText: { fontSize: 20 },
  title: { flex: 1, fontSize: 17, fontWeight: '800' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 14 },
  sendBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  sendBtnText: { fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subject: { fontSize: 12, fontWeight: '700' },
  status: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 14, lineHeight: 20 },
  adminNote: { fontSize: 12, fontStyle: 'italic' },
  points: { fontSize: 12, fontWeight: '600' },
});
