import React, { useCallback, useMemo } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { fetchConversations, Conversation } from '../api/messages';

const formatName = (user?: Conversation['other_user']) => {
  if (!user) return 'Conversation';
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  }
  return user.username || 'Conversation';
};

export default function InboxScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const conversations = data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherUser = item.other_user;
      const name = formatName(otherUser);
      const messagePreview = item.last_message_preview || 'New conversation';
      const timeLabel = item.last_message_at ? new Date(item.last_message_at).toLocaleString() : '';
      const noticeLabel = item.notice_title ? `Regarding: ${item.notice_title}` : undefined;
      const unread = item.unread_count ?? 0;
      const avatarUri = otherUser?.avatar_url;

      return (
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: theme.colors.border }]}
          onPress={() => {
            const target = navigation?.getParent?.() ?? navigation;
            target?.navigate('Conversation', {
              conversationId: item.id,
              title: name,
              noticeTitle: item.notice_title || undefined,
            });
          }}
          activeOpacity={0.85}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                {name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.rowContent}>
            <View style={styles.rowHeader}>
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              {timeLabel ? (
                <Text style={[styles.time, { color: theme.colors.muted }]} numberOfLines={1}>
                  {timeLabel}
                </Text>
              ) : null}
            </View>
            {noticeLabel ? (
              <Text style={[styles.noticeTag, { color: theme.colors.primary }]} numberOfLines={1}>
                {noticeLabel}
              </Text>
            ) : null}
            <Text style={{ color: theme.colors.muted }} numberOfLines={2}>
              {messagePreview}
            </Text>
          </View>
          {unread > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: theme.colors.primaryContrast, fontWeight: '700', fontSize: 12 }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : (
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.muted} />
          )}
        </TouchableOpacity>
      );
    },
  [navigation, theme.colors.border, theme.colors.muted, theme.colors.primary, theme.colors.primaryContrast, theme.colors.text]);

  const listEmpty = useMemo(() => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="email-outline" size={36} color={theme.colors.muted} />
      <Text style={[styles.emptyText, { color: theme.colors.muted }]}>No conversations yet.</Text>
      <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: spacing.xs }}>
        Reach out to a notice author to start a conversation.
      </Text>
    </View>
  ), [theme.colors.muted]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HeaderBar title="Inbox" subtitle="Direct messages" />
      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: 12,
  },
  noticeTag: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  unreadBadge: {
    minWidth: 28,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
