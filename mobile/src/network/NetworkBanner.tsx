// Banner canh bao mat ket noi mang (TASK 11) - hien O TREN CUNG man hinh (duoi status bar) khi
// thiet bi mat mang, TU AN khi co mang lai. Dung `expo-network` (module chinh thuc cua Expo,
// hoat dong ca trong Expo Go - khac Google/Apple Sign-In can dev build) - lang nghe THEO SU KIEN
// (khong polling) qua hook `useNetworkState()`.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Network from 'expo-network';
import { useAppTheme } from '../theme/ThemeContext';

export function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const networkState = Network.useNetworkState();

  // `isConnected`: co ket noi vat ly (wifi/data) hay khong. `isInternetReachable`: THUC SU co
  // Internet hay khong (vd wifi noi bo khong co Internet that). Coi la "mat mang" neu 1 trong 2
  // gia tri XAC DINH la false - luc app moi mo (`undefined`), CHUA ket luan gi de tranh nhap nhay.
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  if (!isOffline) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.danger, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.text}>⚠️ Mất kết nối mạng. Đang chờ kết nối lại...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
