import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, View } from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Theme, spacing } from '../theme';
import FormTextInput from '../components/FormTextInput';
import ScreenContainer from '../components/ScreenContainer';
import Card from '../components/Card';
import SectionHeading from '../components/SectionHeading';

type UserDetail = {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_faculty?: boolean;
  push_enabled?: boolean;
  school?: string | null;
  course?: string | null;
  academic_year?: string | null;
};

type Props = {
  route: { params: { id: number } };
  navigation: any;
};

export default function AdminUserEditScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await api.get(`/users/profiles/${id}/`);
        if (mounted) {
          setUser(response.data);
        }
      } catch (err) {
        if (mounted) setError('Failed to load user');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onUpdate = async () => {
    if (!user) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/users/profiles/${id}/`, {
        first_name: user.first_name,
        last_name: user.last_name,
        designation: user.designation,
        department: user.department,
        phone: user.phone,
        is_faculty: user.is_faculty,
        push_enabled: user.push_enabled,
      });
      Alert.alert('Saved', 'User updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <ScreenContainer title="Edit User">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title={user.username} padded={false}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.sm }}>
          <SectionHeading title="Account info" />
          <StaticField label="Email" value={user.email || 'No email'} />
          <StaticField label="School" value={user.school || 'Not set'} />
          <StaticField label="Course" value={user.course || 'Not set'} />
          <StaticField label="Academic year" value={user.academic_year || 'Not set'} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <SectionHeading title="Edit permissions" />
          <FormTextInput
            label="First name"
            value={user.first_name || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, first_name: t } : prev))}
          />

          <FormTextInput
            label="Last name"
            value={user.last_name || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, last_name: t } : prev))}
          />

          <FormTextInput
            label="Designation"
            value={user.designation || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, designation: t } : prev))}
          />

          <FormTextInput
            label="Department"
            value={user.department || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, department: t } : prev))}
          />

          <FormTextInput
            label="Phone"
            value={user.phone || ''}
            onChangeText={(t) => setUser((prev) => (prev ? { ...prev, phone: t } : prev))}
            keyboardType="phone-pad"
          />

          <View style={styles.switchRow(theme)}>
            <Text style={styles.switchLabel(theme)}>Faculty member</Text>
            <Switch
              value={!!user.is_faculty}
              onValueChange={(v) => setUser((prev) => (prev ? { ...prev, is_faculty: v } : prev))}
            />
          </View>

          <View style={styles.switchRow(theme)}>
            <Text style={styles.switchLabel(theme)}>Push enabled</Text>
            <Switch
              value={!!user.push_enabled}
              onValueChange={(v) => setUser((prev) => (prev ? { ...prev, push_enabled: v } : prev))}
            />
          </View>

          {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}
          <PrimaryButton title={saving ? 'Saving…' : 'Save changes'} onPress={onUpdate} />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = {
  readonly: (theme: Theme): ViewStyle => ({
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  }),
  switchRow: (theme: Theme): ViewStyle => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  }),
  switchLabel: (theme: Theme): TextStyle => ({
    color: theme.colors.text,
    fontSize: 15,
  }),
};

const StaticField = ({ label, value }: { label: string; value: string }) => {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.colors.muted, fontSize: 12, textTransform: 'uppercase' }}>{label}</Text>
      <View style={styles.readonly(theme)}>
        <Text style={{ color: theme.colors.text }}>{value}</Text>
      </View>
    </View>
  );
};
