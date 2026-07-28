// Khung Admin placeholder - dot nay CHUA lam chuc nang quan tri thuc te (se gan dan o cac dot
// sau, giong cach MainTabNavigator hien "Sap ra mat" cho hoc sinh). Co san nut Dang xuat vi day
// la nhu cau THIET YEU cua vong doi xac thuc (khong the coi la "tinh nang chuc nang" can hoan lai).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdminAuth } from './AdminAuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';

export function AdminHomeScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAdminAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24 }]}>
      <Text style={[styles.emoji]}>🛠️</Text>
      <Text style={[styles.title, { color: colors.text }]}>Khu vực Quản trị</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Các chức năng quản trị (quản lý người dùng, câu hỏi, đề thi...) sẽ được bổ sung ở các đợt tiếp
        theo.
      </Text>

      <View style={styles.footer}>
        <PrimaryButton title="Đăng xuất" onPress={signOut} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  emoji: { fontSize: 56, marginTop: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  footer: { position: 'absolute', bottom: 40, left: 24, right: 24 },
});
