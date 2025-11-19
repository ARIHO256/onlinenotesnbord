import React, { useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { api } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import HeaderBar from '../components/HeaderBar';
import OfflineBanner from '../components/OfflineBanner';
import TweetCard from '../components/TweetCard';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import { getNoticeCategoryLabel } from '../constants/notices';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import AttachmentPreviewModal from '../components/AttachmentPreviewModal';
import { fetchFriendRequests } from '../api/friends';

type NoticeViewMode = 'feed' | 'trending' | 'most' | 'favorites' | 'suggested' | 'search';
type NoticeSection = 'for_you' | 'campus_life' | 'business' | 'education';

type NoticeAttachment = {
  id: number;
  url: string;
  file_type?: string;
  original_name?: string | null;
};

type Notice = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_by_username: string;
  created_by_full_name?: string;
  created_by_avatar?: string | null;
  created_by_friend_status?: string;
  created_by_friend_request_id?: number | null;
  created_by_friend_request_id?: number | null;
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
  created_by_friend_status?: string;
};

const FEED_SECTIONS: { key: NoticeSection; label: string; icon: string }[] = [
  { key: 'for_you', label: 'For You', icon: 'account-heart-outline' },
  { key: 'campus_life', label: 'Campus Life', icon: 'account-group-outline' },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' },
  { key: 'education', label: 'Education', icon: 'school-outline' },
];

const VIEW_MODE_TITLES: Record<NoticeViewMode, string> = {
  feed: 'NoticeBoard',
  trending: 'Trending Notices',
  most: 'Most Liked',
  favorites: 'Favorites',
  suggested: 'Suggested',
  search: 'Search',
};

const VIEW_MODE_ENDPOINTS: Record<Exclude<NoticeViewMode, 'feed'>, string> = {
  trending: '/notices/trending/',
  most: '/notices/most-liked/',
  favorites: '/notices/favorites/',
  suggested: '/notices/suggested/',
  search: '/notices/',
};

export default function HomeScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const net = useNetInfo();
  const { signOut } = useContext(AuthContext);
  const [items, setItems] = useState<Notice[]>([]);
  const [isFaculty, setIsFaculty] = useState<boolean>(false);
  const [isStaff, setIsStaff] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<NoticeViewMode>('feed');
  const [section, setSection] = useState<NoticeSection>('for_you');
  const [query, setQuery] = useState('');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [globalPreview, setGlobalPreview] = useState<NoticeAttachment | null>(null);
  const isOnline = net.isConnected !== false;
  const noticeRefetchInterval = isOnline ? 15000 : false;
  const trendingRefetchInterval = isOnline ? 20000 : false;
  const navigateTo = useCallback(
    <K extends keyof RootStackParamList>(route: K, params?: RootStackParamList[K]) => {
      const parent = navigation && typeof navigation.getParent === 'function' ? navigation.getParent() : null;
      const target = parent ?? navigation;
      if (target?.navigate) {
        target.navigate(route as never, params as never);
      }
    },
    [navigation],
  );

  useEffect(() => {
    api.get('/users/profiles/me/').then((r) => {
      setIsFaculty(!!r.data.is_faculty);
      setIsStaff(!!r.data.is_staff);
      setCurrentUser(r.data);
    });
  }, []);

  useEffect(() => {
    const requestedMode = route?.params?.mode as NoticeViewMode | undefined;
    if (requestedMode) {
      setViewMode(requestedMode);
    } else {
      setViewMode('feed');
    }
  }, [route?.params?.mode]);

  useEffect(() => {
    if (viewMode !== 'feed') {
      setSection('for_you');
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'search' && query) {
      setQuery('');
    }
  }, [query, viewMode]);

  const fetchPage = useCallback(
    async ({ pageParam = 1 }) => {
      let url: string;
      const params: Record<string, any> = {};
      if (viewMode === 'feed') {
        url = '/notices/';
        if (section !== 'for_you') {
          params.category = section;
        }
      } else {
        url = VIEW_MODE_ENDPOINTS[viewMode] ?? '/notices/';
      }
      params.page = pageParam;
      if (query) {
        params.search = query;
      }
      const response = await api.get(url, {
        params,
      });
      const payload = response.data;
      let results: Notice[] = [];
      let nextPage: number | undefined;

      if (Array.isArray(payload)) {
        results = payload.filter((item): item is Notice => !!item && typeof item.id !== 'undefined');
      } else if (payload && Array.isArray(payload.results)) {
        results = payload.results.filter((item: Notice) => !!item && typeof item.id !== 'undefined');
        if (payload.next) {
          try {
            const parsed = new URL(payload.next, 'http://dummy');
            const nextParam = parsed.searchParams.get('page');
            if (nextParam) nextPage = Number(nextParam);
          } catch {
            nextPage = undefined;
          }
        }
      }

      return { results, nextPage };
    },
    [query, section, viewMode],
  );

  const {
    data,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['notices', viewMode, section, query],
    queryFn: fetchPage,
    getNextPageParam: (lastPage: { results: Notice[]; nextPage?: number }) => lastPage.nextPage,
    enabled: isOnline,
    initialPageParam: 1,
    refetchInterval: noticeRefetchInterval,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
  });

  const trendingQuery = useQuery({
    queryKey: ['trending-top'],
    queryFn: async () => {
      const response = await api.get('/notices/trending/');
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload.filter((item): item is Notice => !!item && typeof item.id !== 'undefined');
      }
      if (payload && Array.isArray(payload.results)) {
        return payload.results.filter((item: Notice) => !!item && typeof item.id !== 'undefined');
      }
      return [] as Notice[];
    },
    enabled: isOnline && viewMode === 'feed',
    refetchInterval: trendingRefetchInterval,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
  });
  const { refetch: refetchTrending } = trendingQuery;
  const friendRequestsQuery = useQuery({
    queryKey: ['friend-requests', 'incoming', 'badge'],
    queryFn: () => fetchFriendRequests('incoming'),
  });
  useFocusEffect(
    useCallback(() => {
      refetch();
      if (viewMode === 'feed') {
        refetchTrending();
      }
    }, [refetch, refetchTrending, viewMode])
  );

  useEffect(() => {
    if (!data?.pages) {
      setItems([]);
      return;
    }
    const flattened = data.pages.flatMap((page) =>
      Array.isArray(page.results)
        ? page.results.filter((item): item is Notice => !!item && typeof item.id !== 'undefined')
        : [],
    );
    const mergedMap = new Map<number, Notice>();
    flattened.forEach((notice) => {
      if (notice && typeof notice.id !== 'undefined') {
        mergedMap.set(notice.id, notice);
      }
    });
    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) => {
      const pinnedDiff = Number(b.is_pinned ? 1 : 0) - Number(a.is_pinned ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    setItems(merged);
  }, [data, viewMode, section, query]);

  const themedContainer = useMemo(
    () => [styles.container, { backgroundColor: theme.colors.background }],
    [theme.colors.background],
  );

  const secondaryTextColor = theme.colors.muted;

  const trendingList = useMemo(() => {
    const raw = Array.isArray(trendingQuery.data)
      ? trendingQuery.data.filter((item): item is Notice => !!item && typeof item.id !== 'undefined')
      : [];
    return raw
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime(),
      );
  }, [trendingQuery.data]);

  const showTrending = viewMode === 'feed' && trendingList.length > 0;
  const isInitialLoading = isFetching && !data;
  const renderSectionChip = useCallback(
    (option: (typeof FEED_SECTIONS)[number]) => {
      const active = section === option.key;
      return (
        <TouchableOpacity
          key={option.key}
          onPress={() => setSection(option.key)}
          style={[
            styles.filterChip,
            {
              backgroundColor: active ? theme.colors.primary : theme.colors.surface,
              borderColor: active ? theme.colors.primary : theme.colors.border,
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <MaterialCommunityIcons
              name={option.icon as any}
              size={16}
              color={active ? theme.colors.primaryContrast : theme.colors.text}
            />
            <Text
              style={{
                color: active ? theme.colors.primaryContrast : theme.colors.text,
                fontWeight: '600',
              }}
            >
              {option.label}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [section, theme.colors.border, theme.colors.primary, theme.colors.primaryContrast, theme.colors.surface, theme.colors.text],
  );

  const openAuthorProfile = useCallback(
    (notice: Notice) => {
      if (!notice?.created_by) return;
      navigateTo('UserProfile', {
        userId: notice.created_by,
        name: notice.created_by_full_name || notice.created_by_username,
      });
    },
    [navigateTo],
  );

  const renderNotice = useCallback(
    ({ item }: { item: Notice }) => {
      const createdAtLabel = new Date(item.created_at).toLocaleString();
      const handleLikeToggle = async () => {
        if (item.is_liked) {
          await api.post(`/notices/${item.id}/unlike/`);
        } else {
          await api.post(`/notices/${item.id}/like/`);
        }
        refetch();
      };
      const handleFavoriteToggle = async () => {
        if (item.is_favorited) {
          await api.post(`/notices/${item.id}/unfavorite/`);
        } else {
          await api.post(`/notices/${item.id}/favorite/`);
        }
        if (viewMode === 'favorites') refetch();
      };
      const goToDetail = () => navigateTo('NoticeDetail', { id: item.id });
      return (
        <TweetCard
          {...item}
          created_at={createdAtLabel}
          onPress={goToDetail}
          onCommentPress={goToDetail}
          onLikeToggle={handleLikeToggle}
          onFavoriteToggle={handleFavoriteToggle}
          onAuthorPress={() => openAuthorProfile(item)}
        />
      );
    },
    [navigateTo, openAuthorProfile, refetch, viewMode],
  );

  const renderTrendingCards = useMemo(() => {
    if (!showTrending) return null;
    const cardStyle = {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
    };
    return (
      <View style={styles.trendingSection}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
          <MaterialCommunityIcons name='fire' size={18} color={theme.colors.primary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trending Now</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trendingScrollContent}
        >
          {trendingList.slice(0, 8).map((item, index) => {
            const attachment = item?.attachments && item.attachments.length > 0 ? item.attachments[0] : undefined;
            const categoryLabel = getNoticeCategoryLabel(item?.category);
            return (
              <TouchableOpacity
                key={`trend-${item?.id ?? index}`}
                activeOpacity={0.85}
                onPress={() => item && navigateTo('NoticeDetail', { id: item.id })}
                style={[styles.trendingCard, cardStyle]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => item && openAuthorProfile(item)}
                  style={styles.trendingHeader}
                >
                  {item?.created_by_avatar ? (
                    <Image source={{ uri: item.created_by_avatar }} style={styles.trendingAvatar} />
                ) : (
                  <View
                    style={[
                      styles.trendingAvatar,
                      styles.avatarPlaceholder,
                      { backgroundColor: theme.colors.border },
                    ]}
                  />
                )}
                <View style={styles.trendingAuthor}>
                  <Text style={[styles.trendingTitle, { color: theme.colors.text }]} numberOfLines={1}>
                    {item?.title ?? 'Untitled'}
                  </Text>
                  <Text style={{ color: secondaryTextColor, fontSize: 12 }} numberOfLines={1}>
                    {item?.created_by_full_name || item?.created_by_username || 'Unknown'}
                  </Text>
                </View>
              </TouchableOpacity>
              {categoryLabel ? (
                <View
                  style={[
                    styles.categoryPill,
                    { backgroundColor: theme.colors.border, marginTop: spacing.xs },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: theme.colors.primary }]}>
                    {categoryLabel}
                  </Text>
                </View>
              ) : null}
              <Text style={{ color: secondaryTextColor, marginTop: spacing.sm }} numberOfLines={3}>
                {item?.description ?? ''}
              </Text>
              {attachment &&
                (() => {
                  switch (attachment.file_type) {
                    case 'image':
                      return (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setGlobalPreview(attachment)}>
                          <View style={styles.trendingMediaWrapper}>
                            <Image source={{ uri: attachment.url }} style={styles.trendingMedia} resizeMode="cover" />
                          </View>
                        </TouchableOpacity>
                      );
                    case 'video':
                    case 'audio':
                      return (
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setGlobalPreview(attachment)}>
                          <View style={styles.trendingMediaWrapper}>
                            <AttachmentMediaPlayer
                              uri={attachment.url}
                              style={styles.trendingVideo}
                              showControls
                              contentFit="contain"
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    default:
                      return (
                        <Pressable
                          style={styles.trendingDocument}
                          onPress={(event) => {
                            event?.stopPropagation?.();
                            if (attachment.url) {
                              Linking.openURL(attachment.url);
                            }
                          }}
                        >
                          <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.colors.primary} />
                          <Text style={{ color: theme.colors.primary, fontWeight: '600', marginLeft: spacing.xs }}>
                            {attachment.original_name || 'View attachment'}
                          </Text>
                        </Pressable>
                      );
                  }
                })()}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [
    navigateTo,
    openAuthorProfile,
    secondaryTextColor,
    showTrending,
    theme.colors.border,
    theme.colors.card,
    theme.colors.primary,
    theme.colors.text,
    trendingList,
  ]);

  const searchHeader = useMemo(() => {
    if (viewMode !== 'search') return null;
    return (
      <View style={styles.searchBarContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.muted} />
          <TextInput
            placeholder="Search notices"
            placeholderTextColor={theme.colors.muted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: theme.colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => refetch()}
          />
          {query ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={{ padding: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.searchHint, { color: theme.colors.muted }]}>
          Search by title, description, department, or author.
        </Text>
      </View>
    );
  }, [query, refetch, theme.colors.border, theme.colors.muted, theme.colors.surface, theme.colors.text, viewMode]);

  const listHeader = useMemo(() => {
    return (
      <View style={styles.headerContainer}>
        {net.isConnected === false ? <OfflineBanner /> : null}
        <View style={styles.headerInner}>
          {viewMode === 'feed' ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {FEED_SECTIONS.map(renderSectionChip)}
              </ScrollView>
              {renderTrendingCards}
            </>
          ) : (
            <>
              <View style={styles.modeBanner}>
                <Text style={{ color: theme.colors.muted, fontSize: 13, fontWeight: '600' }}>
                  {VIEW_MODE_TITLES[viewMode]}
                </Text>
              </View>
              {searchHeader}
            </>
          )}
        </View>
      </View>
    );
  }, [net.isConnected, renderSectionChip, renderTrendingCards, searchHeader, theme.colors.muted, viewMode]);

  const renderEmpty = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator />
          <Text style={[styles.emptyText, { color: secondaryTextColor, marginTop: spacing.sm }]}>
            Loading notices…
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name='bell-off-outline' size={36} color={secondaryTextColor} />
        <Text style={[styles.emptyText, { color: secondaryTextColor, marginTop: spacing.sm }]}>
          No notices to show yet.
        </Text>
      </View>
    );
  }, [isInitialLoading, secondaryTextColor]);

  const renderFooter = useCallback(() => {
    return isFetchingNextPage ? (
      <View style={styles.footerWrapper}>
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      </View>
    ) : null;
  }, [isFetchingNextPage]);

  const canManageUsers = isStaff;

  const headerLeft = useMemo(() => {
    const fallbackAvatar =
      'https://ui-avatars.com/api/?name=Bugema&background=4338CA&color=fff&size=64';
    const avatarUri = currentUser?.avatar_url || fallbackAvatar;
    return (
      <TouchableOpacity
        onPress={() => setProfileMenuVisible(true)}
        style={styles.headerAvatarButton}
        activeOpacity={0.85}
      >
        <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
      </TouchableOpacity>
    );
  }, [currentUser?.avatar_url]);

  const headerActions = useMemo(() => {
    return (
      <View style={styles.headerIconRow}>
        <TouchableOpacity onPress={() => navigateTo('Friends')} activeOpacity={0.85}>
          <View>
            <MaterialCommunityIcons name="account-multiple-outline" size={22} color={theme.colors.text} />
            {(friendRequestsQuery.data?.length || 0) > 0 ? (
              <View style={[styles.friendBadge, { backgroundColor: theme.colors.primary }]} />
            ) : null}
          </View>
        </TouchableOpacity>
        {canManageUsers ? (
          <TouchableOpacity onPress={() => navigateTo('AdminUserList')} activeOpacity={0.85}>
            <MaterialCommunityIcons name="account-group-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => navigateTo('CreateNotice')} activeOpacity={0.85}>
          <MaterialCommunityIcons name="plus-circle-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }, [canManageUsers, friendRequestsQuery.data?.length, navigateTo, theme.colors.primary, theme.colors.text]);

  const headerTitle = 'Home';

  return (
    <>
      <SafeAreaView style={themedContainer}>
      <Modal
        transparent
        visible={profileMenuVisible}
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setProfileMenuVisible(false)}>
          <View
            style={[
              styles.profileMenu,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                navigateTo('Profile');
              }}
            >
              <MaterialCommunityIcons name="account-circle-outline" size={18} color={theme.colors.text} />
              <Text style={[styles.profileMenuText, { color: theme.colors.text }]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                signOut();
              }}
            >
              <MaterialCommunityIcons name="logout" size={18} color="#ef4444" />
              <Text style={[styles.profileMenuText, { color: '#ef4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <HeaderBar title={headerTitle} left={headerLeft} right={headerActions} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => null}
        renderItem={renderNotice}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isFetchingNextPage} onRefresh={() => refetch()} />
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
      </SafeAreaView>
      <AttachmentPreviewModal
        visible={!!globalPreview}
        attachment={globalPreview}
        onClose={() => setGlobalPreview(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingBottom: spacing.md,
  },
  headerInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchBarContainer: {
    paddingRight: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  searchHint: {
    marginTop: spacing.xs,
    fontSize: 12,
  },
  filterRow: {
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trendingSection: {
    marginTop: spacing.md,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerAvatarButton: {
    paddingHorizontal: spacing.sm,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  friendBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'flex-start',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  trendingScrollContent: {
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  modeBanner: {
    paddingVertical: spacing.sm,
  },
  trendingCard: {
    width: 220,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
  trendingAuthor: {
    flex: 1,
  },
  trendingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  trendingMediaWrapper: {
    marginTop: spacing.sm,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trendingMedia: {
    width: '100%',
    height: 120,
  },
  trendingVideo: {
    width: '100%',
    height: 140,
  },
  trendingDocument: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeAuthorInfo: {
    flex: 1,
  },
  noticeAuthor: {
    fontWeight: '700',
    fontSize: 16,
  },
  noticeTimestamp: {
    fontSize: 12,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticePinned: {
    marginRight: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  noticeDescription: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
  },
  noticeMediaWrapper: {
    marginTop: spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  noticeMedia: {
    width: '100%',
    height: 200,
  },
  noticeVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  noticeDocument: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  noticeMetricsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  noticeActionLabel: {
    marginLeft: 6,
    fontSize: 12,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.md,
  },
  footerWrapper: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  listContent: {
    paddingBottom: spacing.xl * 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  headerActionPrimaryText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  headerActionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  headerActionOutlineText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 13,
  },
  profileMenu: {
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  profileMenuText: {
    fontWeight: '600',
  },
});
