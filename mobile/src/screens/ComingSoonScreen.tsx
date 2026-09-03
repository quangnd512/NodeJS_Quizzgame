// Man hinh placeholder dung chung cho cac tab CHUA lam noi dung (Luyen tap/Thi thu/Xep hang/Tien
// do) - se duoc thay bang man hinh thuc te o cac dot tiep theo (1b/1c/1d...). TASK 8.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeContext';

interface ComingSoonScreenProps {
  emoji: string;
  title: string;
}

export function ComingSoonScreen({ emoji, title }: ComingSoonScreenProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Sắp ra mắt 🚧</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 8 },
});
