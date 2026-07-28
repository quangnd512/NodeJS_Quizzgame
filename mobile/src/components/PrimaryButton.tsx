// Nut bam dung chung, tu doi mau theo Dark Mode - tranh lap lai style o tung man hinh.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../theme/ThemeContext';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** 'outline' dung cho hanh dong phu (vd "Dang nhap Admin", "Dang xuat"). */
  variant?: 'solid' | 'outline' | 'danger';
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'solid' }: PrimaryButtonProps) {
  const { colors } = useAppTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'solid' ? colors.primary : variant === 'danger' ? 'transparent' : 'transparent';
  const borderColor = variant === 'danger' ? colors.danger : variant === 'outline' ? colors.border : 'transparent';
  const textColor = variant === 'solid' ? colors.primaryText : variant === 'danger' ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor, borderWidth: variant === 'solid' ? 0 : 1, opacity: pressed ? 0.7 : isDisabled ? 0.5 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
