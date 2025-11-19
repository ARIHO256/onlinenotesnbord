import { api } from './client';

export type MiniUser = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
};

export type Conversation = {
  id: number;
  notice?: number | null;
  notice_title?: string | null;
  other_user?: MiniUser | null;
  last_message_preview?: string;
  last_message_by?: number | null;
  last_message_at?: string | null;
  unread_count?: number;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: number;
  sender: MiniUser;
  content: string;
  created_at: string;
  read_at?: string | null;
  is_mine: boolean;
};

export const fetchConversations = async (): Promise<Conversation[]> => {
  const response = await api.get<Conversation[]>('/messages/conversations/');
  return Array.isArray(response.data) ? response.data : response.data.results || [];
};

export const openConversation = async (payload: {
  notice_id?: number;
  recipient_id?: number;
  first_message?: string;
}): Promise<Conversation> => {
  const response = await api.post<Conversation>('/messages/conversations/', payload);
  return response.data;
};

export const fetchConversationMessages = async (
  conversationId: number,
  page = 1,
): Promise<{ results: ConversationMessage[]; nextPage?: number }> => {
  const response = await api.get(`/messages/conversations/${conversationId}/messages/`, {
    params: { page },
  });
  const payload = response.data as any;
  let results: ConversationMessage[] = [];
  let nextPage: number | undefined;
  if (Array.isArray(payload)) {
    results = payload;
  } else if (payload?.results) {
    results = payload.results as ConversationMessage[];
    if (payload.next) {
      try {
        const parsed = new URL(payload.next, 'http://dummy');
        const pageParam = parsed.searchParams.get('page');
        if (pageParam) nextPage = Number(pageParam);
      } catch {
        nextPage = undefined;
      }
    }
  }
  return { results, nextPage };
};

export const sendConversationMessage = async (conversationId: number, content: string) => {
  const response = await api.post(`/messages/conversations/${conversationId}/messages/`, { content });
  return response.data as ConversationMessage;
};
