import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, style }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          marginHorizontal: spacing.lg,
          marginVertical: spacing.sm,
          borderRadius: 18,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 18,
          elevation: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
