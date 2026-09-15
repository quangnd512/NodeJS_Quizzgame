// Man hinh Ket qua tran thi dau — hien ket qua WIN/LOSE/DRAW + bien dong diem.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../auth/AuthContext';
import type { BattleMatchResult } from '../../battle/battleSocket';
import type { BattleStackScreenProps } from '../../navigation/types';
import ShareCard from '../../components/share/ShareCard';
import { useShareCard } from '../../hooks/useShareCard';

type Props = BattleStackScreenProps<'BattleResult'>;

const RESULT_CONFIG: Record<BattleMatchResult, { icon: string; label: string; color: string }> = {
  WIN: { icon: '🏆', label: 'Chiến thắng!', color: '#16a34a' },
  LOSE: { icon: '😢', label: 'Thua cuộc', color: '#dc2626' },
  DRAW: { icon: '🤝', label: 'Hoà', color: '#f59e0b' },
  OPPONENT_LEFT_WIN: { icon: '🏳️', label: 'Thắng — Đối thủ bỏ cuộc', color: '#16a34a' },
  CANCELLED_BOTH_LEFT: { icon: '⚠️', label: 'Trận đấu bị huỷ', color: '#6b7280' },
};

export function BattleResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const { ended, opponentName } = route.params;

  const cfg = RESULT_CONFIG[ended.result];
  const { cardRef, sharing, shareAsImage } = useShareCard();

  // Du lieu cho card chia se
  const isWin  = ended.result === 'WIN' || ended.result === 'OPPONENT_LEFT_WIN';
  const isDraw = ended.result === 'DRAW' || ended.result === 'CANCELLED_BOTH_LEFT';
  const shareResultTxt = isWin ? 'THẮNG 🏆' : isDraw ? 'HÒA 🤝' : 'THUA';
  const pointsStr      = ended.pointsChange >= 0
    ? `+${ended.pointsChange} điểm`
    : `${ended.pointsChange} điểm`;
  const shareUserName  = profile?.displayName ?? profile?.email ?? '';

  return (
    <>
      {/* ShareCard off-screen — ViewShot chup tu day */}
      <View
        style={styles.offScreen}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <View ref={cardRef}>
          <ShareCard
            userName={shareUserName}
            result={shareResultTxt}
            subtitle={pointsStr}
            type="battle"
          />
        </View>
      </View>

    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 32 }]}
    >
      {/* Ket qua chinh */}
      <Text style={styles.resultIcon}>{cfg.icon}</Text>
      <Text style={[styles.resultLabel, { color: cfg.color }]}>{cfg.label}</Text>

      {/* So sanh diem */}
      <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreCol}>
            <Text style={[styles.playerName, { color: colors.text }]}>Bạn</Text>
            <Text style={[styles.scoreVal, { color: colors.primary }]}>{ended.myScore}</Text>
          </View>
          <Text style={[styles.vs, { color: colors.textMuted }]}>VS</Text>
          <View style={styles.scoreCol}>
            <Text style={[styles.playerName, { color: colors.text }]}>{opponentName}</Text>
            <Text style={[styles.scoreVal, { color: '#dc2626' }]}>{ended.opponentScore}</Text>
          </View>
        </View>
      </View>

      {/* Bien dong diem */}
      <View style={[styles.pointsCard, {
        backgroundColor: ended.pointsChange >= 0 ? '#16a34a18' : '#dc262618',
        borderColor: ended.pointsChange >= 0 ? '#16a34a' : '#dc2626',
      }]}>
        <Text style={[styles.pointsChange, { color: ended.pointsChange >= 0 ? '#16a34a' : '#dc2626' }]}>
          {ended.pointsChange >= 0 ? '+' : ''}{ended.pointsChange} điểm
        </Text>
        <Text style={[styles.newBalance, { color: colors.textMuted }]}>
          Số dư mới: {ended.newBalance} điểm
        </Text>
      </View>

      {/* Nut hanh dong */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.replace('BattleHome')}
      >
        <Text style={styles.btnText}>⚔️ Chơi lại</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.shareBtn, { borderColor: colors.primary }]}
        onPress={() => { void shareAsImage(); }}
        disabled={sharing}
      >
        <Text style={[styles.shareBtnText, { color: colors.primary }]}>
          {sharing ? '⏳ Đang tạo ảnh...' : '📤 Chia sẻ kết quả'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnOutline, { borderColor: colors.border }]}
        onPress={() => navigation.getParent()?.navigate('ProfileHome')}
      >
        <Text style={[styles.btnOutlineText, { color: colors.text }]}>← Về hồ sơ</Text>
      </TouchableOpacity>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  offScreen: { position: 'absolute', left: -9999, top: -9999, opacity: 0 },
  shareBtn: { width: '100%', borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { fontSize: 15, fontWeight: '700' },
  container: { paddingHorizontal: 24, paddingBottom: 48, gap: 20, alignItems: 'center' },
  resultIcon: { fontSize: 72 },
  resultLabel: { fontSize: 26, fontWeight: '900' },
  scoreCard: { borderWidth: 1, borderRadius: 16, padding: 20, width: '100%' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  scoreCol: { alignItems: 'center', gap: 6, flex: 1 },
  playerName: { fontSize: 14, fontWeight: '600' },
  scoreVal: { fontSize: 40, fontWeight: '900' },
  vs: { fontSize: 18, fontWeight: '900', paddingHorizontal: 8 },
  pointsCard: { borderWidth: 1.5, borderRadius: 14, padding: 18, width: '100%', alignItems: 'center', gap: 6 },
  pointsChange: { fontSize: 32, fontWeight: '900' },
  newBalance: { fontSize: 14 },
  btn: { width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: { width: '100%', borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
