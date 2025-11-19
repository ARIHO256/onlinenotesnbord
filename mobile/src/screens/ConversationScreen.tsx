import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import type { RootStackParamList } from '../App';
import {
  fetchConversationMessages,
  sendConversationMessage,
  ConversationMessage,
} from '../api/messages';

const PAGE_SIZE = 10;

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export default function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, title, noticeTitle } = route.params;
  const { theme } = useTheme();
  const [text, setText] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: ({ pageParam = 1 }) => fetchConversationMessages(conversationId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  const messages = useMemo(() => {
    if (!data?.pages) return [] as ConversationMessage[];
    return data.pages.flatMap((page) => page.results);
  }, [data]);

  const handleSend = useCallback(async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    try {
      await sendConversationMessage(conversationId, value);
      refetch();
    } catch (error: any) {
      setText(value);
      const detail = error?.response?.data?.detail || 'Unable to send message.';
      Alert.alert('Message not sent', detail);
    }
  }, [conversationId, refetch, text]);

  const renderMessage = useCallback(
    ({ item }: { item: ConversationMessage }) => {
      const isMine = item.is_mine;
      const sentAt = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusIcon =
        item.is_mine && (
          <MaterialCommunityIcons
            name="check-all"
            size={16}
            color={item.read_at ? theme.colors.primary : theme.colors.muted}
            style={{ marginLeft: 4 }}
          />
        );
      return (
        <View
          style={[
            styles.messageRow,
            { justifyContent: isMine ? 'flex-end' : 'flex-start' },
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              {
                backgroundColor: isMine ? theme.colors.primary : theme.colors.surface,
                borderColor: isMine ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: isMine ? theme.colors.primaryContrast : theme.colors.text,
              }}
            >
              {item.content}
            </Text>
            <View style={styles.messageMetaRow}>
              <Text style={[styles.messageMeta, { color: theme.colors.muted }]}>{sentAt}</Text>
              {statusIcon}
            </View>
          </View>
        </View>
      );
    },
    [theme.colors.border, theme.colors.muted, theme.colors.primary, theme.colors.primaryContrast, theme.colors.surface, theme.colors.text]
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const headerLeft = useMemo(() => (
    <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: spacing.md }}>
      <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.text} />
    </TouchableOpacity>
  ), [navigation, theme.colors.text]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HeaderBar title={title || 'Conversation'} subtitle={noticeTitle} left={headerLeft} showProfileAvatar={false} />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })}>
        <View style={[styles.composerTop, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TextInput
            placeholder="Message"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { color: theme.colors.text }]}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButton, { opacity: text.trim() ? 1 : 0.4 }]}
            disabled={!text.trim()}
          >
            <MaterialCommunityIcons name="send" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <FlatList
        style={styles.list}
        data={messages}
        inverted
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.2}
        onEndReached={loadMore}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing.md }} /> : null}
        refreshing={isFetching}
        onRefresh={() => refetch()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
  },
  messageMeta: {
    fontSize: 10,
    marginTop: spacing.xs,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  composerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: spacing.md,
  },
});
