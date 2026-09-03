// Man hinh Dang nhap hoc sinh - nut Google (moi nen tang) + Apple (CHI iOS). TASK 4 + TASK 5.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { isAppleSignInPlatform } from '../auth/appleSignIn';
import { useAppTheme } from '../theme/ThemeContext';
import { PrimaryButton } from '../components/PrimaryButton';
import type { AuthStackScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: AuthStackScreenProps<'Login'>) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple, lastError, clearError } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const handleGoogle = async () => {
    setLoadingProvider('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.warn('[LoginScreen] Dang nhap Google that bai:', err);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleApple = async () => {
    setLoadingProvider('apple');
    try {
      await signInWithApple();
    } catch (err) {
      console.warn('[LoginScreen] Dang nhap Apple that bai:', err);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>QuizzGame</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Ôn thi tốt nghiệp THPT cùng bạn bè</Text>
      </View>

      <View style={styles.actions}>
        {lastError ? (
          <Text style={[styles.error, { color: colors.danger }]} onPress={clearError}>
            {lastError}
          </Text>
        ) : null}

        <PrimaryButton
          title="Đăng nhập bằng Google"
          onPress={handleGoogle}
          loading={loadingProvider === 'google'}
          disabled={loadingProvider !== null}
        />

        {isAppleSignInPlatform ? (
          <View style={styles.spacer}>
            <PrimaryButton
              title="Đăng nhập bằng Apple"
              onPress={handleApple}
              loading={loadingProvider === 'apple'}
              disabled={loadingProvider !== null}
              variant="outline"
            />
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.adminLink, { color: colors.textMuted }]}
        onPress={() => navigation.navigate('AdminLogin')}
      >
        Bạn là Quản trị viên? Đăng nhập tại đây
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingBottom: 32 },
  header: { alignItems: 'center', marginTop: 40 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 15, marginTop: 8, textAlign: 'center' },
  actions: { gap: 12 },
  spacer: { marginTop: 4 },
  error: { textAlign: 'center', marginBottom: 4, fontSize: 14 },
  adminLink: { textAlign: 'center', fontSize: 13, textDecorationLine: 'underline' },
});
