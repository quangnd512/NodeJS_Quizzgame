// Man hinh ket qua tran dau PvP.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext.js';
import type { ProfileStackScreenProps } from '../../navigation/types.js';

type Props = ProfileStackScreenProps<'BattleResult'>;

const RESULT_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  WIN: { emoji: '🏆', label: 'CHIẾN THẮNG!', color: '#16a34a' },
  LOSE: { emoji: '😔', label: 'THUA CUỘC', color: '#dc2626' },
  DRAW: { emoji: '🤝', label: 'HÒA', color: '#d97706' },
  OPPONENT_LEFT_WIN: { emoji: '🏆', label: 'THẮNG (Đối thủ bỏ cuộc)', color: '#16a34a' },
  CANCELLED_BOTH_LEFT: { emoji: '🚫', label: 'HỦY TRẬN', color: '#6b7280' },
};

export function BattleResultScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { myScore, opponentScore, result, pointsChange } = route.params;

  const cfg = RESULT_CONFIG[result] ?? { emoji: '❓', label: result, color: colors.textMuted };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text style={styles.emoji}>{cfg.emoji}</Text>
      <Text style={[styles.result, { color: cfg.color }]}>{cfg.label}</Text>

      <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreCol}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Bạn</Text>
            <Text style={[styles.scoreVal, { color: colors.text }]}>{myScore}</Text>
          </View>
          <Text style={[styles.vs, { color: colors.textMuted }]}>–</Text>
          <View style={[styles.scoreCol, { alignItems: 'flex-end' }]}>
            <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Đối thủ</Text>
            <Text style={[styles.scoreVal, { color: colors.text }]}>{opponentScore}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.pointsRow}>
          <Text style={[styles.pointsLabel, { color: colors.textMuted }]}>Điểm thay đổi</Text>
          <Text
            style={[
              styles.pointsVal,
              { color: pointsChange >= 0 ? '#16a34a' : colors.danger },
            ]}
          >
            {pointsChange >= 0 ? '+' : ''}{pointsChange}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('BattleLobby')}
      >
        <Text style={[styles.btnText, { color: colors.primaryText }]}>⚔️ Thi đấu tiếp</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, { borderColor: colors.border }]}
        onPress={() => navigation.navigate('ProfileHome')}
      >
        <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Về hồ sơ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, gap: 20 },
  emoji: { fontSize: 72 },
  result: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  scoreCard: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreCol: { flex: 1 },
  scoreLabel: { fontSize: 13, fontWeight: '600' },
  scoreVal: { fontSize: 32, fontWeight: '900' },
  vs: { fontSize: 24, fontWeight: '700' },
  divider: { height: 1 },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pointsLabel: { fontSize: 14 },
  pointsVal: { fontSize: 20, fontWeight: '800' },
  btn: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: '800', fontSize: 16 },
  btnSecondary: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontWeight: '600', fontSize: 16 },
});
