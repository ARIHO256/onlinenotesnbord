import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import { useTheme } from '../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '../theme';
import HeaderBar from '../components/HeaderBar';
import Card from '../components/Card';
import AttachmentMediaPlayer from '../components/AttachmentMediaPlayer';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  FriendStatus,
  sendFriendRequest,
} from '../api/friends';

type Props = NativeStackScreenProps<RootStackParamList, 'NoticeDetail'>;

type NoticeAttachment = {
  id: number;
  url: string;
  file_type: 'image' | 'video' | 'audio' | 'document' | string;
  original_name?: string | null;
};

type NoticeComment = {
  id: number;
  username: string;
  user_full_name?: string | null;
  user_avatar?: string | null;
  text: string;
  created_at?: string;
  parent_id?: number | null;
  likes_count?: number;
  is_liked?: boolean;
  replies?: NoticeComment[];
};

type CommentTreeResult = {
  data: NoticeComment[];
  changed: boolean;
};

const normalizeComment = (comment: NoticeComment): NoticeComment => ({
  ...comment,
  replies: comment.replies ? comment.replies.map(normalizeComment) : [],
  likes_count: comment.likes_count ?? 0,
  is_liked: Boolean(comment.is_liked),
});

const insertComment = (tree: NoticeComment[], incoming: NoticeComment): CommentTreeResult => {
  const normalized = normalizeComment(incoming);
  if (!incoming.parent_id) {
    return {
      changed: true,
      data: [normalized, ...tree],
    };
  }
  let changed = false;
  const nextTree = tree.map((node) => {
    if (node.id === incoming.parent_id) {
      changed = true;
      const replies = node.replies ? [normalized, ...node.replies] : [normalized];
      return { ...node, replies };
    }
    if (node.replies && node.replies.length > 0) {
      const { data, changed: childChanged } = insertComment(node.replies, incoming);
      if (childChanged) {
        changed = true;
        return { ...node, replies: data };
      }
    }
    return node;
  });
  return { data: changed ? nextTree : tree, changed };
};

const updateCommentTree = (
  tree: NoticeComment[],
  commentId: number,
  updater: (comment: NoticeComment) => NoticeComment,
): CommentTreeResult => {
  let changed = false;
  const nextTree = tree.map((node) => {
    if (node.id === commentId) {
      changed = true;
      return updater(node);
    }
    if (node.replies && node.replies.length > 0) {
      const { data, changed: childChanged } = updateCommentTree(node.replies, commentId, updater);
      if (childChanged) {
        changed = true;
        return { ...node, replies: data };
      }
    }
    return node;
  });
  return { data: changed ? nextTree : tree, changed };
};

type NoticeDetail = {
  id: number;
  title: string;
  description: string;
  created_by: number;
  department?: string | null;
  is_pinned?: boolean;
  scheduled_at?: string | null;
  created_by_username: string;
  created_by_full_name?: string | null;
  created_by_avatar?: string | null;
  created_by_friend_status?: FriendStatus;
  created_by_friend_request_id?: number | null;
  created_by_friend_status?: FriendStatus;
  created_by_friend_request_id?: number | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  views_count?: number;
  likes_count?: number;
  favorites_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  attachments?: NoticeAttachment[];
};

type Profile = {
  id: number;
  is_staff: boolean;
  username: string;
} & Record<string, any>;

export default function NoticeDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commentInputRef = useRef<TextInput | null>(null);
  const [item, setItem] = useState<NoticeDetail | null>(null);
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<Profile | null>(null);
  const [replyingTo, setReplyingTo] = useState<NoticeComment | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [authorFriendStatus, setAuthorFriendStatus] = useState<FriendStatus>('unknown');
  const [authorFriendRequestId, setAuthorFriendRequestId] = useState<number | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [noticeResp, commentResp] = await Promise.all([
          api.get<NoticeDetail>(`/notices/${id}/`),
          api.get<NoticeComment[]>(`/notices/${id}/comments/`, {
            params: { max_depth: 3 },
          }),
        ]);
        setItem(noticeResp.data);
        const incoming = Array.isArray(commentResp.data) ? commentResp.data : [];
        setComments(incoming.map(normalizeComment));
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
    api.get<Profile>('/users/profiles/me/').then((r) => setMe(r.data));
  }, [id, load]);

  const handleLikeToggle = useCallback(async () => {
    if (!item) return;
    const liked = Boolean(item.is_liked);
    setItem((prev) =>
      prev
        ? {
            ...prev,
            is_liked: !liked,
            likes_count: Math.max(0, (prev.likes_count ?? 0) + (liked ? -1 : 1)),
          }
        : prev,
    );
    try {
      await api.post(`/notices/${id}/${liked ? 'unlike' : 'like'}/`);
    } catch (err) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              is_liked: liked,
              likes_count: Math.max(0, (prev.likes_count ?? 0) + (liked ? 1 : -1)),
            }
          : prev,
      );
    }
  }, [id, item]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!item) return;
    const favorited = Boolean(item.is_favorited);
    setItem((prev) =>
      prev
        ? {
            ...prev,
            is_favorited: !favorited,
            favorites_count: Math.max(0, (prev.favorites_count ?? 0) + (favorited ? -1 : 1)),
          }
        : prev,
    );
    try {
      await api.post(`/notices/${id}/${favorited ? 'unfavorite' : 'favorite'}/`);
    } catch (err) {
      setItem((prev) =>
        prev
          ? {
              ...prev,
              is_favorited: favorited,
              favorites_count: Math.max(0, (prev.favorites_count ?? 0) + (favorited ? 1 : -1)),
            }
          : prev,
      );
    }
  }, [id, item]);

  const handleCommentSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !item || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const payload: Record<string, any> = { text: trimmed };
      if (replyingTo) {
        payload.parent = replyingTo.id;
      }
      const response = await api.post<NoticeComment>(`/notices/${id}/comments/`, payload);
      setComments((prev) => {
        const { data, changed } = insertComment(prev, response.data);
        return changed ? data : prev;
      });
      setItem((prev) =>
        prev
          ? { ...prev, comments_count: (prev.comments_count ?? 0) + 1 }
          : prev,
      );
      setText('');
      setReplyingTo(null);
      setTimeout(() => {
        commentInputRef.current?.blur();
      }, 100);
    } catch (err) {
      Alert.alert('Error', 'Unable to post comment. Please try again.');
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentSubmitting, id, item, replyingTo, text]);

  const handleCommentLikeToggle = useCallback(
    async (comment: NoticeComment) => {
      const endpoint = comment.is_liked ? 'unlike' : 'like';
      setComments((prev) => {
        const { data } = updateCommentTree(prev, comment.id, (node) => ({
          ...node,
          is_liked: !node.is_liked,
          likes_count: Math.max(0, (node.likes_count ?? 0) + (node.is_liked ? -1 : 1)),
        }));
        return data;
      });
      try {
        await api.post(`/notices/${id}/comments/${comment.id}/${endpoint}/`);
      } catch (err) {
        setComments((prev) => {
          const { data } = updateCommentTree(prev, comment.id, (node) => ({
            ...node,
            is_liked: !node.is_liked,
            likes_count: Math.max(0, (node.likes_count ?? 0) + (node.is_liked ? -1 : 1)),
          }));
          return data;
        });
      }
    },
    [id],
  );

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
  }, []);

  const handleStartReply = useCallback(
    (comment: NoticeComment) => {
      setReplyingTo(comment);
      focusComposer();
    },
    [focusComposer],
  );

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  useEffect(() => {
    if (item) {
      setAuthorFriendStatus(item.created_by_friend_status || 'unknown');
      setAuthorFriendRequestId(item.created_by_friend_request_id ?? null);
    }
  }, [item]);

  const handleShare = useCallback(async () => {
    if (!item) return;
    const message = `${item.title}\n\n${item.description}${
      item.department ? `\n\nDepartment: ${item.department}` : ''
    }`;
    try {
      await Share.share({ message });
    } catch (err) {
      // no-op
    }
  }, [item]);

  const handleMessageAuthor = useCallback(async () => {
    if (!item) return;
    setMessageLoading(true);
    try {
      const response = await api.post('/messages/conversations/', { notice_id: item.id });
      const conversation = response.data as { id: number };
      navigation.navigate('Conversation', {
        conversationId: conversation.id,
        title: item.created_by_full_name || item.created_by_username,
        noticeTitle: item.title,
      });
    } catch (err) {
      Alert.alert('Messaging unavailable', 'Unable to open a conversation right now. Please try again once you are friends.');
    } finally {
      setMessageLoading(false);
    }
  }, [item, navigation]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!item) return;
    try {
      const request = await sendFriendRequest(item.created_by);
      setAuthorFriendStatus('outgoing');
      setAuthorFriendRequestId(request.id);
      Alert.alert('Request sent', 'Friend request sent successfully.');
    } catch (error: any) {
      const detail = error?.response?.data?.detail || 'Unable to send a friend request.';
      Alert.alert('Error', detail);
    }
  }, [item]);

  const handleCancelFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await cancelFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('none');
      setAuthorFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to cancel this request.');
    }
  }, [authorFriendRequestId]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await acceptFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('friends');
      setAuthorFriendRequestId(null);
      load();
    } catch {
      Alert.alert('Error', 'Unable to accept this request.');
    }
  }, [authorFriendRequestId, load]);

  const handleDeclineFriendRequest = useCallback(async () => {
    if (!authorFriendRequestId) return;
    try {
      await declineFriendRequest(authorFriendRequestId);
      setAuthorFriendStatus('none');
      setAuthorFriendRequestId(null);
    } catch {
      Alert.alert('Error', 'Unable to decline this request.');
    }
  }, [authorFriendRequestId]);

  const handleAttachmentRemove = useCallback(
    async (attachmentId: number) => {
      if (!item) return;
      Alert.alert('Remove attachment', 'Are you sure you want to remove this attachment?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/notices/${id}/attachments/${attachmentId}/`);
              setItem((prev) =>
                prev
                  ? {
                      ...prev,
                      attachments: (prev.attachments || []).filter((att) => att.id !== attachmentId),
                    }
                  : prev,
              );
            } catch (err) {
              Alert.alert('Error', 'Could not remove attachment.');
            }
          },
        },
      ]);
    },
    [id, item],
  );

  const handleReport = useCallback(async () => {
    try {
      await api.post(`/notices/${id}/report/`, { reason: 'Inappropriate' });
      Alert.alert('Thank you', 'We have received your report.');
    } catch (err) {
      Alert.alert('Error', 'Unable to submit report right now.');
    }
  }, [id]);

  const handlePinToggle = useCallback(async () => {
    if (!item) return;
    try {
      if (item.is_pinned) {
        await api.post(`/notices/${id}/unpin/`);
      } else {
        await api.post(`/notices/${id}/pin/`);
      }
      setItem((prev) => (prev ? { ...prev, is_pinned: !prev.is_pinned } : prev));
    } catch (err) {
      Alert.alert('Error', 'Unable to update pin status.');
    }
  }, [id, item]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete notice', 'This action cannot be undone. Delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notices/${id}/`);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete notice.');
          }
        },
      },
    ]);
  }, [id, navigation]);

  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const toggleReplies = (commentId: number) => {
    setExpandedComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const renderCommentNode = (comment: NoticeComment, depth = 0): React.ReactNode => {
    const repliesCount = comment.replies?.length ?? 0;
    const isExpanded = expandedComments[comment.id];
    const replies =
      comment.replies && comment.replies.length > 0 && isExpanded
        ? comment.replies.map((child) => renderCommentNode(child, depth + 1))
        : null;
    const displayName = comment.user_full_name || comment.username;
    const handle = `@${comment.username}`;
    const timestamp = comment.created_at ? new Date(comment.created_at).toLocaleString() : '';
    const avatarUri = comment.user_avatar;
    const hasReplies = Boolean(replies && replies.length > 0);
    const indent = depth > 0 ? { marginLeft: depth * spacing.md } : null;

    return (
      <View key={`${comment.id}-${depth}`} style={indent}>
        <View style={styles.commentThreadRow}>
          <View style={styles.commentAvatarColumn}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.commentAvatarImage} />
            ) : (
              <View style={[styles.commentAvatarImage, styles.commentAvatarFallback]}>
                <Text style={styles.commentAvatarInitial}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            {hasReplies ? <View style={styles.commentConnector} /> : null}
          </View>
          <View
            style={[
              styles.commentBubbleCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.commentBubbleHeader}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('UserProfile', {
                    userId: comment.id,
                    name: displayName,
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={[styles.commentAuthor, { color: theme.colors.text }]}>{displayName}</Text>
              </TouchableOpacity>
              <Text style={[styles.commentHandle, { color: theme.colors.muted }]}>{handle}</Text>
              {timestamp ? (
                <>
                  <Text style={{ color: theme.colors.muted, marginHorizontal: 4 }}>•</Text>
                  <Text style={[styles.commentTimestamp, { color: theme.colors.muted }]}>{timestamp}</Text>
                </>
              ) : null}
            </View>
            <Text style={[styles.commentText, { color: theme.colors.text }]}>{comment.text}</Text>
            <View style={styles.commentActionsBar}>
              <TouchableOpacity
                style={styles.commentActionPill}
                activeOpacity={0.8}
                onPress={() => handleStartReply(comment)}
              >
                <MaterialCommunityIcons name="reply" size={16} color={theme.colors.muted} />
                <Text style={[styles.commentActionLabel, { color: theme.colors.muted }]}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentActionPill}
                activeOpacity={0.8}
                onPress={() => handleCommentLikeToggle(comment)}
              >
                <MaterialCommunityIcons
                  name={comment.is_liked ? 'heart' : 'heart-outline'}
                  size={16}
                  color={comment.is_liked ? '#e0245e' : theme.colors.muted}
                />
                <Text
                  style={[
                    styles.commentActionLabel,
                    { color: comment.is_liked ? '#e0245e' : theme.colors.muted },
                  ]}
                >
                  {comment.likes_count ?? 0}
                </Text>
              </TouchableOpacity>
              {repliesCount > 0 ? (
                <TouchableOpacity
                  style={styles.commentActionPill}
                  activeOpacity={0.8}
                  onPress={() => toggleReplies(comment.id)}
                >
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.muted}
                  />
                  <Text style={[styles.commentActionLabel, { color: theme.colors.muted }]}>
                    {isExpanded ? 'Hide replies' : `${repliesCount} repl${repliesCount === 1 ? 'y' : 'ies'}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        {replies ? <View style={styles.commentRepliesContainer}>{replies}</View> : null}
      </View>
    );
  };

  const isOwner = !!(me && item && me.id === item.created_by);
  const attachments = item?.attachments || [];
  const hasAttachments = attachments.length > 0;
  const extraAttachments = attachments.length > 1 ? attachments.slice(1) : [];
  const goToAuthorProfile = useCallback(() => {
    if (!item) return;
    navigation.navigate('UserProfile', {
      userId: item.created_by,
      name: item.created_by_full_name || item.created_by_username,
    });
  }, [item, navigation]);

  if ((!item || loading) && !refreshing) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={{ color: theme.colors.text }}>Notice not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <HeaderBar title="Notice" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card>
          <TouchableOpacity style={styles.headerRow} activeOpacity={0.85} onPress={goToAuthorProfile}>
            {item.created_by_avatar ? (
              <Image source={{ uri: item.created_by_avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>
                {item.created_by_full_name || item.created_by_username}
              </Text>
              <Text style={styles.timeMeta}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            {item.is_pinned ? (
              <MaterialCommunityIcons
                name="pin"
                size={18}
                color={theme.colors.primary}
                style={{ marginRight: spacing.xs }}
              />
            ) : null}
            <Text style={styles.title}>{item.title}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="office-building-marker-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.metaChipText}>{item.department || 'General'}</Text>
            </View>
          </View>

          <Text style={styles.description}>{item.description}</Text>

          {hasAttachments ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attachmentStrip}
            >
          {(item.attachments ?? []).map((attachment) => {
                const baseWrapper = (
                  <View key={attachment.id} style={styles.attachmentWrapper}>
                    {(() => {
                      switch (attachment.file_type) {
                        case 'image':
                          return (
                            <Image
                              source={{ uri: attachment.url }}
                              style={styles.attachmentImage}
                              resizeMode="cover"
                            />
                          );
                        case 'video':
                        case 'audio':
                          return (
                            <AttachmentMediaPlayer
                              uri={attachment.url}
                              style={styles.attachmentVideo}
                              showControls
                              contentFit="contain"
                            />
                          );
                        default:
                          return (
                            <TouchableOpacity
                              style={styles.attachmentDocument}
                              activeOpacity={0.8}
                              onPress={() => Linking.openURL(attachment.url)}
                            >
                              <MaterialCommunityIcons
                                name="file-document-outline"
                                size={20}
                                color={theme.colors.primary}
                              />
                              <Text
                                style={{
                                  color: theme.colors.primary,
                                  fontWeight: '600',
                                  marginLeft: spacing.sm,
                                }}
                              >
                                {attachment.original_name || 'Open attachment'}
                              </Text>
                            </TouchableOpacity>
                          );
                      }
                    })()}
                    {isOwner ? (
                      <TouchableOpacity
                        style={styles.attachmentRemove}
                        onPress={() => handleAttachmentRemove(attachment.id)}
                      >
                        <MaterialCommunityIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
                return baseWrapper;
              })}
            </ScrollView>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="eye-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.statText}>{item.views_count ?? 0} views</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="heart-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.statText}>{item.likes_count ?? 0} likes</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="bookmark-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.statText}>{item.favorites_count ?? 0} saves</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
              <MaterialCommunityIcons
                name={item.is_liked ? 'heart' : 'heart-outline'}
                size={22}
                color={item.is_liked ? '#e0245e' : theme.colors.muted}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: item.is_liked ? '#e0245e' : theme.colors.muted },
                ]}
              >
                {item.likes_count ?? 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleFavoriteToggle}>
              <MaterialCommunityIcons
                name={item.is_favorited ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={item.is_favorited ? theme.colors.primary : theme.colors.muted}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: item.is_favorited ? theme.colors.primary : theme.colors.muted },
                ]}
              >
                {item.favorites_count ?? 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
            {!isOwner && authorFriendStatus === 'friends' ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMessageAuthor}
                disabled={messageLoading}
              >
                <MaterialCommunityIcons
                  name="email-outline"
                  size={22}
                  color={messageLoading ? theme.colors.muted : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    { color: messageLoading ? theme.colors.muted : theme.colors.primary },
                  ]}
                >
                  {messageLoading ? 'Opening…' : 'Message'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {!isOwner && authorFriendStatus !== 'friends' ? (
            <View style={styles.friendActionRow}>
              {authorFriendStatus === 'incoming' ? (
                <>
                  <TouchableOpacity
                    style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
                    onPress={handleAcceptFriendRequest}
                  >
                    <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
                    onPress={handleDeclineFriendRequest}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Decline</Text>
                  </TouchableOpacity>
                </>
              ) : authorFriendStatus === 'outgoing' ? (
                <>
                  <View style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}>
                    <Text style={{ color: theme.colors.muted, fontWeight: '600' }}>Request sent</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.friendSecondaryButton, { borderColor: theme.colors.border }]}
                    onPress={handleCancelFriendRequest}
                  >
                    <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.friendPrimaryButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleSendFriendRequest}
                >
                  <Text style={{ color: theme.colors.primaryContrast, fontWeight: '600' }}>Add Friend</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.commentsHeading}>Comments</Text>
          {comments.length === 0 ? (
            <Text style={styles.emptyState}>Be the first to share your thoughts.</Text>
          ) : (
            comments.map((comment) => renderCommentNode(comment))
          )}
          {replyingTo ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                Replying to {replyingTo.user_full_name || replyingTo.username}
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <Text style={styles.replyBannerAction}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.commentComposer}>
            <TextInput
              ref={commentInputRef}
              placeholder={replyingTo ? 'Write a reply' : 'Write a comment'}
              value={text}
              onChangeText={setText}
              style={styles.commentInput}
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <Button
              title={commentSubmitting ? 'Sending...' : 'Send'}
              onPress={handleCommentSubmit}
              disabled={commentSubmitting || text.trim().length === 0}
            />
          </View>
          <View style={styles.commentActions}>
            <Button title="Report" color={theme.colors.primary} onPress={handleReport} />
          </View>
        </Card>

        {isOwner ? (
          <Card>
            <View style={styles.ownerActions}>
              <Button title={item.is_pinned ? 'Unpin notice' : 'Pin notice'} onPress={handlePinToggle} />
              <View style={styles.ownerActionsSpacer} />
              <Button title="Edit notice" onPress={() => navigation.navigate('EditNotice', { id })} />
              <View style={styles.ownerActionsSpacer} />
              <Button title="Delete notice" color="#e11d48" onPress={handleDelete} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: typeof import('../theme').lightTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: spacing.md,
    },
    avatarFallback: {
      backgroundColor: theme.colors.border,
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      fontWeight: '700',
      fontSize: 16,
      color: theme.colors.text,
    },
    timeMeta: {
      color: theme.colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      flex: 1,
      color: theme.colors.text,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: spacing.xs,
    },
    metaChipText: {
      color: theme.colors.text,
      fontSize: 12,
    },
    description: {
      fontSize: 16,
      lineHeight: 22,
      color: theme.colors.text,
    },
    attachmentStrip: {
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    attachmentWrapper: {
      position: 'relative',
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    attachmentImage: {
      width: 240,
      height: 160,
      borderRadius: 12,
    },
    attachmentVideo: {
      width: 240,
      height: 180,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    attachmentDocument: {
      width: 240,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    attachmentRemove: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      padding: 4,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    statText: {
      color: theme.colors.muted,
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    friendActionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    friendPrimaryButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
    },
    friendSecondaryButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 999,
      borderWidth: 1,
    },
    commentsHeading: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: spacing.md,
      color: theme.colors.text,
    },
    emptyState: {
      color: theme.colors.muted,
      marginBottom: spacing.md,
    },
    commentThreadRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    commentAvatarColumn: {
      alignItems: 'center',
      width: 36,
    },
    commentAvatarImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    commentAvatarFallback: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.border,
    },
    commentAvatarInitial: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    commentConnector: {
      flex: 1,
      width: 1,
      backgroundColor: theme.colors.border,
      marginTop: spacing.xs,
    },
    commentBubbleCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 18,
      padding: spacing.md,
      gap: spacing.xs,
    },
    commentBubbleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    commentAuthor: {
      fontWeight: '700',
      fontSize: 14,
    },
    commentHandle: {
      fontSize: 12,
    },
    commentTimestamp: {
      fontSize: 12,
    },
    commentText: {
      fontSize: 14,
      lineHeight: 20,
    },
    commentActionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    commentActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs / 2,
    },
    commentActionLabel: {
      fontSize: 12,
      fontWeight: '600',
    },
    commentRepliesContainer: {
      marginTop: spacing.sm,
      paddingLeft: spacing.sm,
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: spacing.md,
    },
    replyBannerText: {
      color: theme.colors.text,
      fontSize: 13,
      flex: 1,
    },
    replyBannerAction: {
      color: theme.colors.primary,
      fontWeight: '600',
      marginLeft: spacing.md,
    },
    commentComposer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    commentInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      minHeight: 44,
      maxHeight: 120,
    },
    commentActions: {
      marginTop: spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    ownerActions: {
      gap: spacing.sm,
    },
    ownerActionsSpacer: {
      height: spacing.sm,
    },
  });
