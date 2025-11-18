import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { getNoticeCategoryLabel } from '../constants/notices';
import AttachmentMediaPlayer from './AttachmentMediaPlayer';

export type NoticeAttachment = {
  id: number;
  url: string;
  file_type?: string;
  original_name?: string | null;
};

export type NoticeCardProps = {
  id: number;
  title: string;
  description: string;
  created_by_username: string;
  created_by_full_name?: string;
  created_by_avatar?: string | null;
  created_at: string;
  department?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean;
  attachments?: NoticeAttachment[];
  category?: string | null;
  onPress: () => void;
  onLikeToggle: () => Promise<void> | void;
  onFavoriteToggle: () => Promise<void> | void;
  onCommentPress: () => void;
  onAuthorPress?: () => void;
};

export default function TweetCard({
  title,
  description,
  created_by_full_name,
  created_by_username,
  created_by_avatar,
  created_at,
  department,
  views_count,
  likes_count,
  comments_count,
  is_liked,
  is_favorited,
  is_pinned,
  attachments,
  category,
  onPress,
  onLikeToggle,
  onFavoriteToggle,
  onCommentPress,
  onAuthorPress,
}: NoticeCardProps) {
  const { theme } = useTheme();
  const displayName = created_by_full_name || created_by_username;
  const handleAttachmentPress = (url?: string) => {
    if (url) Linking.openURL(url);
  };
  const media = attachments?.[0];
  const categoryLabel = getNoticeCategoryLabel(category);
  const authorPressableProps = onAuthorPress
    ? {
        onPress: onAuthorPress,
        activeOpacity: 0.85,
      }
    : null;

  const avatar = created_by_avatar ? (
    <Image source={{ uri: created_by_avatar }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]} />
  );

  const avatarBlock = authorPressableProps ? (
    <TouchableOpacity {...authorPressableProps}>{avatar}</TouchableOpacity>
  ) : (
    avatar
  );

  const authorMeta = (
    <>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
        <Text style={[styles.meta, { color: theme.colors.muted }]}>{created_at}</Text>
      </View>
      {department ? (
        <Text style={[styles.department, { color: theme.colors.muted }]}>{department}</Text>
      ) : null}
      {categoryLabel ? (
        <View style={[styles.badge, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{categoryLabel}</Text>
        </View>
      ) : null}
    </>
  );

  const authorBlock = authorPressableProps ? (
    <TouchableOpacity {...authorPressableProps}>{authorMeta}</TouchableOpacity>
  ) : (
    authorMeta
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.row}>
        {avatarBlock}
        <View style={styles.body}>
          {authorBlock}
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.colors.text }]}>{description}</Text>
          {media ? (
            media.file_type === 'image' ? (
              <Image source={{ uri: media.url }} style={styles.media} />
            ) : media.file_type === 'video' || media.file_type === 'audio' ? (
              <AttachmentMediaPlayer
                uri={media.url}
                style={styles.media}
                showControls
                contentFit="cover"
              />
            ) : (
              <TouchableOpacity
                onPress={() => handleAttachmentPress(media.url)}
                style={[
                  styles.document,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons name="file-document-outline" size={20} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                  {media.original_name || 'View attachment'}
                </Text>
              </TouchableOpacity>
            )
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={onCommentPress}>
              <MaterialCommunityIcons name="chat-outline" size={18} color={theme.colors.muted} />
              <Text style={[styles.actionLabel, { color: theme.colors.muted }]}>{comments_count ?? 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onLikeToggle}>
              <MaterialCommunityIcons
                name={is_liked ? 'heart' : 'heart-outline'}
                size={18}
                color={is_liked ? '#f91880' : theme.colors.muted}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: is_liked ? '#f91880' : theme.colors.muted },
                ]}
              >
                {likes_count ?? 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onFavoriteToggle}>
              <MaterialCommunityIcons
                name={is_favorited ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={is_favorited ? theme.colors.primary : theme.colors.muted}
              />
            </TouchableOpacity>
            <View style={styles.viewChip}>
              {is_pinned ? (
                <MaterialCommunityIcons name="pin" size={14} color={theme.colors.primary} />
              ) : null}
              <Text style={[styles.meta, { color: theme.colors.muted }]}>Views {views_count ?? 0}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
  },
  department: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    marginTop: spacing.xs,
    fontSize: 15,
    lineHeight: 20,
  },
  media: {
    marginTop: spacing.sm,
    borderRadius: 16,
    width: '100%',
    height: 220,
  },
  document: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    justifyContent: 'space-between',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: 12,
  },
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});


