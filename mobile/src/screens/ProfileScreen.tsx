// Tab "Ho so" — noi nguoi dung quan ly tai khoan va truy cap cac tinh nang phu.
// Cac tinh nang chinh cua ho so (sua ten, doi anh...) van "Sap ra mat".
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme, type ThemePreference } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';
import { getUnreadCount } from '../api/notifications';
import type { ProfileStackScreenProps } from '../navigation/types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo hệ thống' },
];

type Props = ProfileStackScreenProps<'ProfileHome'>;

// NavItem phai nam NGOAI ProfileScreen de tranh loi "Cannot create components during render"
interface NavItemProps {
  emoji: string;
  label: string;
  badge?: number;
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function NavItem({ emoji, label, badge, onPress, colors }: NavItemProps) {
  return (
    <TouchableOpacity
      style={[styles.navItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.navEmoji}>{emoji}</Text>
      <Text style={[styles.navLabel, { color: colors.text }]}>{label}</Text>
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
        </View>
      ) : null}
      <Text style={[styles.navArrow, { color: colors.textMuted }]}>›</Text>
    </TouchableOpacity>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useAppTheme();
  const { profile, signOut, sessionToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll so thong bao chua doc moi 30 giay
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    function poll() {
      if (!sessionToken || cancelled) return;
      getUnreadCount(sessionToken)
        .then((res) => { if (!cancelled) setUnreadCount(res.count); })
        .catch(() => {});
    }

    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionToken]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      {/* Header ho so */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarInitial}>
            {(profile?.displayName ?? profile?.email ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.displayName ?? 'Chưa đặt tên'}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{profile?.email ?? '—'}</Text>
          {profile?.isPremium && (
            <View style={[styles.premiumBadge, { backgroundColor: '#7c3aed' }]}>
              <Text style={styles.premiumBadgeText}>⭐ PREMIUM</Text>
            </View>
          )}
        </View>
      </View>

      {/* Diem tich luy */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Điểm tích lũy</Text>
        <Text style={[styles.points, { color: colors.primary }]}>{profile?.points ?? 0} điểm</Text>
      </View>

      {/* Mon hoc */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Môn học đang ôn</Text>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>
          {profile && profile.subjects.length > 0 ? profile.subjects.map((s) => s.name).join(', ') : 'Chưa chọn môn'}
        </Text>
      </View>

      {/* Cac tinh nang phu */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>TÍNH NĂNG</Text>

      <NavItem
        emoji="🔔"
        label="Thông báo"
        badge={unreadCount}
        onPress={() => navigation.push('Notifications')}
        colors={colors}
      />
      <NavItem
        emoji="❌"
        label="Ôn câu sai"
        onPress={() => navigation.push('WrongAnswers')}
        colors={colors}
      />
      <NavItem
        emoji="📋"
        label="Lịch sử bài thi"
        onPress={() => navigation.push('Submissions')}
        colors={colors}
      />
      <NavItem
        emoji="⚔️"
        label="Thi đấu đối kháng"
        onPress={() => navigation.push('Battle')}
        colors={colors}
      />

      {/* Giao dien */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Giao diện</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                style={[
                  styles.themeOption,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' },
                ]}
              >
                <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: '600' }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Dang xuat */}
      <View style={styles.footer}>
        <PrimaryButton title="Đăng xuất" onPress={signOut} variant="danger" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  headerText: { flex: 1, gap: 3 },
  name: { fontSize: 18, fontWeight: '800' },
  email: { fontSize: 13 },
  premiumBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  premiumBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  points: { fontSize: 22, fontWeight: '800' },
  bodyText: { fontSize: 14 },
  sectionHeader: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  navEmoji: { fontSize: 22 },
  navLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  navArrow: { fontSize: 22, fontWeight: '300' },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  footer: { marginTop: 4 },
});
