import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import type { RootStackParamList } from '../App';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  showProfileAvatar?: boolean;
};

export default function HeaderBar({ title, subtitle, left, right, showProfileAvatar = true }: Props) {
  const { theme } = useTheme();
  const resolvedSubtitle = subtitle ?? 'Stay informed, stay ahead.';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: currentUser } = useCurrentUserProfile();
  const canShowAvatar = showProfileAvatar && !right;
  const avatarUri = currentUser?.avatar_url;
  const initials = currentUser?.first_name?.[0] || currentUser?.username?.[0] || '?';

  const profileAvatar = canShowAvatar ? (
    <TouchableOpacity
      onPress={() => navigation.navigate('Profile')}
      activeOpacity={0.85}
      style={[styles.profileButton, { borderColor: theme.colors.border }]}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.profileImage} />
      ) : (
        <Text style={[styles.profileInitials, { color: theme.colors.text }]}>{initials}</Text>
      )}
    </TouchableOpacity>
  ) : null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderBottomColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={styles.side}>{left}</View>
      <View style={styles.titleWrapper}>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontFamily: theme.fonts.title,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.subtitleRow}>
          <View style={[styles.pillDot, { backgroundColor: theme.colors.accent }]} />
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.muted,
              },
            ]}
            numberOfLines={1}
          >
            {resolvedSubtitle}
          </Text>
        </View>
      </View>
      <View style={[styles.side, styles.sideRight]}>{right ?? profileAvatar}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitleRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  side: {
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    fontWeight: '700',
  },
});
