// Man hinh cho trong luc AuthProvider/AdminAuthProvider dang doc SecureStore + xac thuc lai token
// cu (status === 'booting') - tranh nhap nhay ve man Dang nhap roi lai nhay vao khung chinh.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

export function SplashScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
