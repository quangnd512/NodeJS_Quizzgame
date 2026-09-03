// Man hinh Dang nhap Admin - nhap X-Admin-Secret (KHONG qua Firebase/Google/Apple). TASK 9.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAdminAuth } from './AdminAuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';

export function AdminLoginScreen() {
  const { colors } = useAppTheme();
  const { signIn, lastError, clearError } = useAdminAuth();
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!secret.trim()) return;
    setLoading(true);
    try {
      await signIn(secret.trim());
    } catch (err) {
      // Loi da duoc AdminAuthContext ghi vao `lastError` de hien thi ben duoi - khong can lam gi them.
      console.warn('[AdminLoginScreen] Dang nhap Admin that bai:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.title, { color: colors.text }]}>Đăng nhập Quản trị viên</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Nhập mã bí mật quản trị (X-Admin-Secret) do hệ thống cấp.
      </Text>

      <TextInput
        value={secret}
        onChangeText={(text) => {
          setSecret(text);
          if (lastError) clearError();
        }}
        placeholder="Nhập mã bí mật..."
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
        onSubmitEditing={handleSubmit}
      />

      {lastError ? <Text style={[styles.error, { color: colors.danger }]}>{lastError}</Text> : null}

      <View style={styles.spacer}>
        <PrimaryButton title="Đăng nhập" onPress={handleSubmit} loading={loading} disabled={!secret.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  error: { marginTop: 12, fontSize: 14 },
  spacer: { marginTop: 20 },
});
