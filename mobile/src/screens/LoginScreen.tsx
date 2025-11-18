import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import FormTextInput from '../components/FormTextInput';
import { useTheme } from '../context/ThemeContext';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import type { RootStackParamList } from '../App';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient, CancelledError } from '@tanstack/react-query';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const schema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useContext(AuthContext);
  const { theme, setMode, mode } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const { handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const queryClient = useQueryClient();

  const onLogin = async (data: z.infer<typeof schema>) => {
    try {
      setError(null);
      const resp = await api.post('/auth/token/', { username: data.email, password: data.password });
      await signIn(resp.data.access);
      type NoticesPage = { results: any[]; nextPage?: number };
      const fetchNoticesPage = async ({ pageParam = 1 }: { pageParam?: number }): Promise<NoticesPage> => {
        const response = await api.get('/notices/', { params: { page: pageParam } });
        const payload = response.data;
        let items: any[] = [];
        let nextPage: number | undefined;
        if (Array.isArray(payload)) {
          items = payload;
        } else if (payload && Array.isArray(payload.results)) {
          items = payload.results;
          if (payload.next) {
            try {
              const parsed = new URL(payload.next, 'https://dummy');
              const nextParam = parsed.searchParams.get('page');
              if (nextParam) nextPage = Number(nextParam);
            } catch {
              nextPage = undefined;
            }
          }
        }
        const results = items.filter((item) => item && typeof item.id !== 'undefined');
        return { results, nextPage };
      };

      try {
        await queryClient.fetchInfiniteQuery({
          queryKey: ['notices', 'all', ''],
          queryFn: fetchNoticesPage,
          initialPageParam: 1,
          getNextPageParam: (lastPage: NoticesPage) => lastPage.nextPage ?? undefined,
        });
      } catch (err) {
        if (!(err instanceof CancelledError)) {
          console.warn('Failed to prefetch notices', err);
        }
      }

      try {
        await queryClient.fetchQuery({
          queryKey: ['trending-top'],
          queryFn: async () => {
            const response = await api.get('/notices/trending/');
            const payload = response.data;
            if (Array.isArray(payload)) {
              return payload.filter((item) => item && typeof item.id !== 'undefined');
            }
            if (payload && Array.isArray(payload.results)) {
              return payload.results.filter((item: any) => item && typeof item.id !== 'undefined');
            }
            return [];
          },
        });
      } catch (err) {
        if (!(err instanceof CancelledError)) {
          console.warn('Failed to prefetch trending notices', err);
        }
      }

      navigation.replace('Home');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: ['trending-top'] });
    } catch (e: any) {
      setError('Invalid credentials');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.brandRow}>
            <MaterialCommunityIcons name="alpha-b-circle" size={28} color={theme.colors.primary} />
            <TouchableOpacity
              onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              style={styles.modeToggle}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={mode === 'dark' ? 'white-balance-sunny' : 'moon-waning-crescent'}
                size={18}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.heading, { color: theme.colors.text }]}>Sign in to Bugema Board</Text>
          <Text style={[styles.subheading, { color: theme.colors.muted }]}>
            Stay close to every department conversation.
          </Text>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow ?? '#000',
              },
            ]}
          >
            <FormTextInput
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(t) => setValue('email', t, { shouldValidate: true })}
              error={errors.email?.message}
              trailing={<MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.muted} />}
            />
            <FormTextInput
              label="Password"
              secureTextEntry
              enablePasswordToggle
              onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
              error={errors.password?.message}
              trailing={<MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.muted} />}
            />
            {error ? (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <PrimaryButton
              title={isSubmitting ? 'Logging in...' : 'Log in'}
              onPress={handleSubmit(onLogin)}
            />
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.secondaryLabel, { color: theme.colors.muted }]}>
              Need an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.8}>
              <Text style={[styles.secondaryLink, { color: theme.colors.primary }]}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'center',
    gap: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeToggle: {
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(100,116,139,0.4)',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 15,
  },
  formCard: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
    gap: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 14,
  },
  secondaryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
