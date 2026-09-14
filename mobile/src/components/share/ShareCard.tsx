import { View, Text, StyleSheet } from 'react-native';
import { SHARE_APP_URL } from '../../constants/shareConfig';

export type ShareCardType = 'exam' | 'battle';

export interface ShareCardProps {
  /** Tên hiển thị của người dùng */
  userName: string;
  /** Kết quả chính hiển thị to, ví dụ: "8.5/10" hoặc "THẮNG" */
  result: string;
  /** Dòng phụ, ví dụ: "Toán Đại số · +120 điểm" */
  subtitle: string;
  /** Loại card: kết quả thi hay battle */
  type: ShareCardType;
}

/**
 * ShareCard (mobile) — View dùng react-native-view-shot chụp thành ảnh PNG.
 * Kích thước cố định 400×220 để ảnh nhất quán (scale 2x khi captureRef).
 */
export default function ShareCard({ userName, result, subtitle, type }: ShareCardProps) {
  const gradientColors = type === 'exam'
    ? { start: '#1e40af', end: '#3b82f6' }
    : { start: '#7c3aed', end: '#a855f7' };

  const typeLabel = type === 'exam' ? '📝 KẾT QUẢ THI THỬ' : '⚔️ KẾT QUẢ BATTLE';

  // React Native không hỗ trợ CSS gradient natively — dùng 2 View chồng màu solid
  // với LinearGradient từ expo-linear-gradient nếu đã cài, hoặc đơn giản dùng startColor
  const bgColor = gradientColors.start;

  return (
    <View style={[styles.card, { backgroundColor: bgColor }]}>
      {/* Decoration circles */}
      <View style={styles.circleTop} />
      <View style={styles.circleBottom} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          <Text style={styles.userName}>{userName || 'Bạn'}</Text>
        </View>
        <Text style={styles.appName}>QuizzGame</Text>
      </View>

      {/* Result */}
      <View style={styles.resultSection}>
        <Text style={styles.resultText}>{result}</Text>
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>

      {/* Footer */}
      <Text style={styles.footerText}>{SHARE_APP_URL || 'QuizzGame'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 400,
    height: 220,
    borderRadius: 16,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  circleTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleBottom: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.9)',
  },
  resultSection: {
    alignItems: 'center',
  },
  resultText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 52,
  },
  subtitleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
  },
});
