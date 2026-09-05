// Man hinh xem ket qua phien on tap.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import type { PracticeStackScreenProps } from '../../navigation/types';

type Props = PracticeStackScreenProps<'PracticeResult'>;

export function PracticeResultScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { score, pointsEarned } = route.params;

  const emoji = score >= 8 ? '🎉' : score >= 6 ? '👍' : '📚';
  const message =
    score >= 8
      ? 'Xuất sắc! Hãy tiếp tục phát huy!'
      : score >= 6
        ? 'Khá tốt! Ôn thêm nhé!'
        : 'Cần cố gắng hơn! Bạn làm được!';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }]}>Kết quả phiên ôn tập</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Điểm số</Text>
          <Text style={[styles.value, { color: colors.text }]}>{score.toFixed(1)}/10</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Điểm tích lũy</Text>
          <Text style={[styles.value, { color: colors.primary }]}>+{pointsEarned} điểm</Text>
        </View>
      </View>

      <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('PracticeHome')}
      >
        <Text style={[styles.btnText, { color: colors.primaryText }]}>Ôn tiếp môn khác</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={() => navigation.navigate('PracticeHome')}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Về trang chính</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  emoji: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 24 },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, marginVertical: 4 },
  label: { fontSize: 15 },
  value: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 15, marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  btn: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnText: { fontWeight: '700', fontSize: 16 },
  btnSecondary: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontWeight: '600', fontSize: 16 },
});
