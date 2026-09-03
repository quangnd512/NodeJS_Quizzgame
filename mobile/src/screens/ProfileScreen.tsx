// Tab "Ho so" - noi DUY NHAT dat cac dieu khien nen tang cua vong doi tai khoan (Dang xuat, chon
// giao dien Sang/Toi/Theo he thong) - day KHONG phai "tinh nang" can hoan lai o dot sau (khac voi 4
// tab con lai chi hien "Sap ra mat"), vi khong the danh gia DoD ve dang nhap/dang xuat/dark mode
// (TASK 6, 10) neu khong co noi nao trong khung dieu huong chinh de nguoi dung thao tac. Cac tinh
// nang THUC SU cua ho so (sua thong tin, doi anh dai dien...) van "Sap ra mat" o cac dot sau.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme, type ThemePreference } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo hệ thống' },
];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference } = useAppTheme();
  const { profile, signOut } = useAuth();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarInitial}>{(profile?.displayName ?? profile?.email ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.displayName ?? 'Chưa đặt tên'}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{profile?.email ?? '—'}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Điểm tích lũy</Text>
        <Text style={[styles.points, { color: colors.primary }]}>{profile?.points ?? 0} điểm</Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Môn học đang ôn</Text>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>
          {profile && profile.subjects.length > 0 ? profile.subjects.map((s) => s.name).join(', ') : 'Chưa chọn môn'}
        </Text>
      </View>

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
                <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: '600' }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="Đăng xuất" onPress={signOut} variant="danger" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  headerText: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  email: { fontSize: 13, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  points: { fontSize: 22, fontWeight: '800' },
  bodyText: { fontSize: 14 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  footer: { marginTop: 8 },
});
