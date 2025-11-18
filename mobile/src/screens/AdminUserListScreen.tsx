import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/Card';
import ScreenContainer from '../components/ScreenContainer';
import { spacing } from '../theme';

type UserRow = {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  is_faculty?: boolean;
};

type DepartmentSection = {
  title: string;
  key: string;
  data: UserRow[];
};

export default function AdminUserListScreen({ navigation }: any) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.get('/users/profiles/');
        if (mounted) {
          setUsers(response.data);
        }
      } catch (err) {
        if (mounted) setError('Failed to load users');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sections = useMemo<DepartmentSection[]>(() => {
    if (!users.length) return [];
    const grouped = new Map<string, UserRow[]>();
    users.forEach((user) => {
      const raw = user.department?.trim();
      const key = raw && raw.length > 0 ? raw : 'Unassigned';
      const list = grouped.get(key);
      if (list) {
        list.push(user);
      } else {
        grouped.set(key, [user]);
      }
    });
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        key: title.toLowerCase().replace(/\s+/g, '-'),
        data: data.sort((lhs, rhs) => {
          const leftName = `${lhs.first_name || ''} ${lhs.last_name || ''}`.trim() || lhs.username;
          const rightName = `${rhs.first_name || ''} ${rhs.last_name || ''}`.trim() || rhs.username;
          return leftName.localeCompare(rightName);
        }),
      }));
  }, [users]);

  const totalMembers = users.length;
  const totalDepartments = sections.length;

  return (
    <ScreenContainer title="Manage Users" padded={false}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('AdminUserEdit', { id: item.id })}
              >
                <Card>
                  <Text
                    style={{
                      fontFamily: theme.fonts.semibold,
                      fontSize: 16,
                      color: theme.colors.text,
                    }}
                  >
                    {name}
                  </Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 4, fontSize: 13 }}>
                    {item.email || 'No email'}
                  </Text>
                  <Text style={{ color: theme.colors.muted, marginTop: 2, fontSize: 13 }}>
                    {item.designation || 'No designation'}
                    {item.is_faculty ? ' • Faculty' : ''}
                  </Text>
                </Card>
              </TouchableOpacity>
            );
          }}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: theme.colors.background,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.semibold,
                    fontSize: 16,
                  }}
                >
                  {section.title}
                </Text>
                <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                  {section.data.length} {section.data.length === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
          )}
          stickySectionHeadersEnabled
          SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
          ListHeaderComponent={
            totalMembers > 0 ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: 18,
                    fontFamily: theme.fonts.semibold,
                  }}
                >
                  {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
                </Text>
                <Text style={{ color: theme.colors.muted, fontSize: 13 }}>
                  Across {totalDepartments} {totalDepartments === 1 ? 'department' : 'departments'}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 32 }}>
              <Text style={{ color: theme.colors.muted }}>No members found.</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
