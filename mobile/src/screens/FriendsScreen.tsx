import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  fetchAllProfiles,
  FriendProfile,
  FriendRequest,
  removeFriend,
  sendFriendRequest,
} from '../api/friends';
import { openConversation } from '../api/messages';

const TABS = [
  { key: 'requests', label: 'Suggestions' },
  { key: 'friends', label: 'Your friends' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function FriendsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<TabKey>('requests');
  const [query, setQuery] = useState('');
  const friendsQuery = useQuery({ queryKey: ['friends'], queryFn: fetchFriends });
  const incomingQuery = useQuery({ queryKey: ['friend-requests', 'incoming'], queryFn: () => fetchFriendRequests('incoming') });
  const outgoingQuery = useQuery({ queryKey: ['friend-requests', 'outgoing'], queryFn: () => fetchFriendRequests('outgoing') });
  const { data: currentUser } = useCurrentUserProfile();
  const {
    data: allUsersPages,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasMoreUsers,
    isFetchingNextPage: isFetchingMoreUsers,
    refetch: refetchAllUsers,
    isFetching: isFetchingAllUsers,
  } = useInfiniteQuery({
    queryKey: ['all-users'],
    queryFn: ({ pageParam = 1 }) => fetchAllProfiles(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });

  useFocusEffect(
    useCallback(() => {
      friendsQuery.refetch();
      incomingQuery.refetch();
      outgoingQuery.refetch();
      refetchAllUsers();
    }, [friendsQuery, incomingQuery, outgoingQuery, refetchAllUsers])
  );

  const refreshing = friendsQuery.isFetching || incomingQuery.isFetching || outgoingQuery.isFetching || isFetchingAllUsers;

  const refreshAll = useCallback(() => {
    friendsQuery.refetch();
    incomingQuery.refetch();
    outgoingQuery.refetch();
    refetchAllUsers();
  }, [friendsQuery, incomingQuery, outgoingQuery, refetchAllUsers]);

  const handleAccept = useCallback(async (request: FriendRequest) => {
    try {
      await acceptFriendRequest(request.id);
      refreshAll();
      Alert.alert('Friend added', `${request.sender.first_name || request.sender.username} is now your friend.`);
    } catch {
      Alert.alert('Error', 'Unable to accept this request.');
    }
  }, [refreshAll]);

  const matchesQuery = useCallback((profile: FriendProfile) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim().toLowerCase();
    const username = (profile.username || '').toLowerCase();
    const dept = (profile.department || '').toLowerCase();
    const designation = (profile.designation || '').toLowerCase();
    return name.includes(q) || username.includes(q) || dept.includes(q) || designation.includes(q);
  }, [query]);

  const filteredFriends = useMemo(
    () => (friendsQuery.data || []).filter(matchesQuery),
    [friendsQuery.data, matchesQuery]
  );
  const filteredIncoming = useMemo(
    () => (incomingQuery.data || []).filter((req) => matchesQuery(req.sender)),
    [incomingQuery.data, matchesQuery]
  );
  const filteredOutgoing = useMemo(
    () => (outgoingQuery.data || []).filter((req) => matchesQuery(req.receiver)),
    [outgoingQuery.data, matchesQuery]
  );
  const filteredSuggestions = useMemo(() => {
    const flattened = (allUsersPages?.pages || []).flatMap((p) => p.results || []);
    return flattened.filter(matchesQuery);
  }, [allUsersPages?.pages, matchesQuery]);

  const handleDecline = useCallback(async (request: FriendRequest) => {
    try {
      await declineFriendRequest(request.id);
      refreshAll();
    } catch {
      Alert.alert('Error', 'Unable to decline this request.');
    }
  }, [refreshAll]);

  const handleRemoveFriend = useCallback(async (friend: FriendProfile) => {
    Alert.alert('Remove friend', `Remove ${friend.first_name || friend.username} from your friends list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(friend.id);
            refreshAll();
          } catch {
            Alert.alert('Error', 'Unable to remove this friend.');
          }
        },
      },
    ]);
  }, [refreshAll]);

  const handleMessage = useCallback(async (friend: FriendProfile) => {
    try {
      const conversation = await openConversation({ recipient_id: friend.id });
      const target = navigation?.getParent?.() ?? navigation;
      target?.navigate('Conversation', {
        conversationId: conversation.id,
        title: friend.first_name ? `${friend.first_name} ${friend.last_name || ''}`.trim() : friend.username,
      });
    } catch (err: any) {
      Alert.alert('Unable to message', err?.response?.data?.detail || 'You can only message accepted friends.');
    }
  }, [navigation]);

  const handleSearchSendRequest = useCallback(async (profile: FriendProfile) => {
    try {
      await sendFriendRequest(profile.id);
      refreshAll();
      Alert.alert('Request sent', `Friend request sent to ${profile.first_name || profile.username}.`);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Unable to send friend request.';
      Alert.alert('Error', detail);
    }
  }, [refreshAll]);

  const handleSearchCancelRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await cancelFriendRequest(profile.friend_request_id);
      refreshAll();
    } catch {
      Alert.alert('Error', 'Unable to cancel this request.');
    }
  }, [refreshAll]);

  const handleSearchAcceptRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await acceptFriendRequest(profile.friend_request_id);
      refreshAll();
    } catch {
      Alert.alert('Error', 'Unable to accept this request.');
    }
  }, [refreshAll]);

  const handleSearchDeclineRequest = useCallback(async (profile: FriendProfile) => {
    if (!profile.friend_request_id) return;
    try {
      await declineFriendRequest(profile.friend_request_id);
      refreshAll();
    } catch {
      Alert.alert('Error', 'Unable to decline this request.');
    }
  }, [refreshAll]);

  const renderTabButton = ({ key, label }: typeof TABS[number]) => (
    <TouchableOpacity
      key={key}
      onPress={() => setTab(key)}
      style={[
        styles.tabButton,
        {
          backgroundColor: tab === key ? theme.colors.primary : theme.colors.surface,
          shadowColor: theme.colors.shadow,
          shadowOpacity: tab === key ? 0.25 : 0,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
          elevation: tab === key ? 3 : 0,
        },
      ]}
      activeOpacity={0.85}
    >
      <Text style={{ color: tab === key ? theme.colors.primaryContrast : theme.colors.text, fontWeight: '600' }}>{label}</Text>
      {key === 'requests' && (filteredIncoming.length || 0) > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryContrast }]}>
          <Text style={{ color: theme.colors.primary }}>{filteredIncoming.length}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderRequestRow = useCallback(
    ({ item }: { item: FriendRequest }) => {
      const user = item.sender;
      const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username;
      const avatar = user.avatar_url;
      const timeLabel = new Date(item.created_at).toLocaleDateString();
      const goToProfile = () =>
        navigation.navigate('UserProfile', {
          userId: user.id,
          name,
        });
      return (
        <View style={[styles.cardRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.border }]}> 
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{name[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.rowBody}>
            <View style={styles.requestRowHeader}>
              <TouchableOpacity onPress={goToProfile} activeOpacity={0.85}>
                <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
              </TouchableOpacity>
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{timeLabel}</Text>
            </View>
            <Text style={{ color: theme.colors.muted, fontSize: 12 }}>{user.username ? `@${user.username}` : ''}</Text>
            <View style={styles.requestButtonsRow}>
              <TouchableOpacity style={styles.confirmButton} onPress={() => handleAccept(item)}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDecline(item)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [handleAccept, handleDecline, navigation, theme.colors.border, theme.colors.muted, theme.colors.surface, theme.colors.text]
  );

  const renderFriendRow = useCallback(
    ({ item }: { item: FriendProfile }) => {
      const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || item.username;
      const mutualCount = item.mutual_friend_count ?? 0;
      return (
        <View style={[styles.cardRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.border }]}> 
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{name[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
            {mutualCount > 0 ? (
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
              </Text>
            ) : null}
            <View style={styles.rowActions}>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} onPress={() => handleMessage(item)}>
                <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={() => navigation.navigate('UserProfile', { userId: item.id, name })}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.colors.border }]} onPress={() => handleRemoveFriend(item)}>
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [handleMessage, handleRemoveFriend, navigation, theme.colors.border, theme.colors.primary, theme.colors.primaryContrast, theme.colors.surface, theme.colors.text]
  );

  const allUsers = useMemo(
    () =>
      allUsersPages?.pages.flatMap((page) =>
        Array.isArray(page.results)
          ? page.results.filter((item): item is FriendProfile => !!item && typeof item.id !== 'undefined')
          : [],
      ) ?? [],
    [allUsersPages],
  );
  const friendRequests = filteredIncoming;
  const suggestions = useMemo(() => {
    const requestIds = new Set(friendRequests.map((req) => req.sender.id));
    return filteredSuggestions.filter((profile) => !requestIds.has(profile.id)).slice(0, 6);
  }, [filteredSuggestions, friendRequests]);

  const data = useMemo(() => {
    if (tab === 'friends') return filteredFriends;
    return filteredIncoming;
  }, [filteredFriends, filteredIncoming, tab]);

  const currentUserId = currentUser?.id ?? null;

  const renderAllUsersRow = useCallback(
    ({ item }: { item: FriendProfile }) => {
      const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || item.username;
      const status = item.friend_status ?? 'none';
      const isSelf = currentUserId === item.id;
      const mutualCount = item.mutual_friend_count ?? 0;
      return (
        <View style={[styles.cardRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.border }]}>
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{name[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.rowBody}>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
            <Text style={{ color: theme.colors.muted, fontSize: 12 }}>@{item.username}</Text>
            {mutualCount > 0 ? (
              <Text style={{ color: theme.colors.muted, fontSize: 12 }}>
                {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
              </Text>
            ) : null}
            {isSelf ? (
              <Text style={{ color: theme.colors.muted, marginTop: spacing.xs }}>This is you.</Text>
            ) : (
              <View style={styles.rowActions}>
                {(status === 'none' || status === 'unknown') ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleSearchSendRequest(item)}
                  >
                    <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Add Friend</Text>
                  </TouchableOpacity>
                ) : null}
                {status === 'outgoing' ? (
                  <>
                    <View style={[styles.secondaryButton, { borderColor: theme.colors.border }]}>
                      <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Request sent</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                      onPress={() => handleSearchCancelRequest(item)}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {status === 'incoming' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => handleSearchAcceptRequest(item)}
                    >
                      <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                      onPress={() => handleSearchDeclineRequest(item)}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Decline</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {status === 'friends' ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => handleMessage(item)}
                  >
                    <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Message</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
                  onPress={() => navigation.navigate('UserProfile', { userId: item.id, name })}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: '600' }}>View</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      );
    },
    [
      currentUserId,
      handleMessage,
      handleSearchAcceptRequest,
      handleSearchCancelRequest,
      handleSearchDeclineRequest,
      handleSearchSendRequest,
      navigation,
      theme.colors.border,
      theme.colors.muted,
      theme.colors.primary,
      theme.colors.primaryContrast,
      theme.colors.text,
    ],
  );



  const listEmpty = useMemo(() => {
    const messageMap: Record<TabKey, string> = {
      requests: 'No friend requests at the moment.',
      friends: 'No friends yet. Send requests to connect.',
    };
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="account-group-outline" size={32} color={theme.colors.muted} />
        <Text style={[styles.emptyText, { color: theme.colors.muted }]}>{messageMap[tab]}</Text>
      </View>
    );
  }, [tab, theme.colors.muted]);

  const renderItem = tab === 'friends' ? renderFriendRow : renderRequestRow;

  const requestsHeaderComponent = useMemo(() => {
    if (tab !== 'requests') return null;
    return (
      <View style={styles.requestsHeaderContainer}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.requestsTitle, { color: theme.colors.text }]}>Friend requests ({friendRequests.length})</Text>
          <Text style={[styles.requestsSubtitle, { color: theme.colors.muted }]}>People who want to connect</Text>
        </View>
        <TouchableOpacity onPress={refreshAll}>
          <Text style={[styles.seeAllLink, { color: theme.colors.primary }]}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }, [friendRequests.length, refreshAll, tab, theme.colors.muted, theme.colors.primary, theme.colors.text]);

  const suggestionsFooterComponent = useMemo(() => {
    if (tab !== 'requests' || suggestions.length === 0) return null;
    return (
      <View style={styles.suggestionsSection}>
        <Text style={[styles.requestsTitle, { color: theme.colors.text }]}>People you may know</Text>
        <View style={{ gap: spacing.sm }}>
          {suggestions.map((profile) => (
            <View key={`suggest-${profile.id}`}>{renderAllUsersRow({ item: profile } as { item: FriendProfile })}</View>
          ))}
        </View>
      </View>
    );
  }, [renderAllUsersRow, suggestions, tab, theme.colors.text]);

  const requestsFooterComponent = useMemo(() => {
    if (tab !== 'requests') return null;
    return (
      <View style={{ gap: spacing.lg }}>
        {suggestionsFooterComponent}
        {isFetchingMoreUsers ? (
          <View style={styles.footer}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : null}
      </View>
    );
  }, [isFetchingMoreUsers, suggestionsFooterComponent, tab, theme.colors.primary]);

  const handleLoadMore = useCallback(() => {
    if (tab === 'requests' && hasMoreUsers && !isFetchingMoreUsers) {
      fetchNextUsers();
    }
  }, [fetchNextUsers, hasMoreUsers, isFetchingMoreUsers, tab]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HeaderBar title="Friends" subtitle="Manage your connections" />
      <View style={[styles.searchBar, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder="Search people by name, username, department"
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: theme.colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.tabRow}>{TABS.map(renderTabButton)}</View>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem as any}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
        ListEmptyComponent={listEmpty}
        ListHeaderComponent={requestsHeaderComponent}
        contentContainerStyle={data?.length ? styles.listContent : styles.emptyContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListFooterComponent={requestsFooterComponent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  badge: {
    marginLeft: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 14,
  },
  requestsHeaderContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  requestsSubtitle: {
    fontSize: 13,
  },
  seeAllLink: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardRow: {
    flexDirection: 'row',
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  requestRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  requestButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#1877F2',
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#3A3B3C',
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestionsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
