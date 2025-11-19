import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Domine_700Bold } from '@expo-google-fonts/domine';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import NoticeDetailScreen from './screens/NoticeDetailScreen';
import CreateNoticeScreen from './screens/CreateNoticeScreen';
import EditNoticeScreen from './screens/EditNoticeScreen';
import ProfileScreen from './screens/ProfileScreen';
import AdminUserListScreen from './screens/AdminUserListScreen';
import AdminUserEditScreen from './screens/AdminUserEditScreen';
import FacultyListScreen from './screens/FacultyListScreen';
import StudentListScreen from './screens/StudentListScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import InboxScreen from './screens/InboxScreen';
import ConversationScreen from './screens/ConversationScreen';
import FriendsScreen from './screens/FriendsScreen';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { registerForPushNotificationsAsync } from './push/registerPush';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  NoticeDetail: { id: number };
  EditNotice: { id: number };
  CreateNotice: undefined;
  Profile: undefined;
  FacultyList: undefined;
  StudentList: undefined;
  AdminUserList: undefined;
  AdminUserEdit: { id: number };
  UserProfile: { userId: number; name?: string };
  Conversation: { conversationId: number; title?: string; noticeTitle?: string | null };
  Friends: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Router() {
  const { token, ready } = useContext(AuthContext);
  if (!ready) return null;
  if (token) registerForPushNotificationsAsync();
  const AuthedTabs = () => (
    <ThemedTabs />
  );

  const ThemedTabs = () => {
    const { theme } = useTheme();
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarIcon: ({ color, size, focused }) => {
            const map: Record<string, string> = {
              HomeTab: focused ? 'home-variant' : 'home-variant-outline',
              SearchTab: 'magnify',
              TrendingTab: 'fire',
              FavoritesTab: focused ? 'bookmark' : 'bookmark-outline',
              InboxTab: focused ? 'email' : 'email-outline',
            };
            const name = map[route.name] || 'dots-circle';
            return <MaterialCommunityIcons name={name as any} color={color} size={size} />;
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="SearchTab" component={HomeScreen} options={{ title: 'Search' }} initialParams={{ mode: 'search' }} />
        <Tab.Screen name="TrendingTab" component={HomeScreen} options={{ title: 'Trending' }} initialParams={{ mode: 'trending' }} />
        <Tab.Screen name="FavoritesTab" component={HomeScreen} options={{ title: 'Favorites' }} initialParams={{ mode: 'favorites' }} />
        <Tab.Screen name="InboxTab" component={InboxScreen} options={{ title: 'Inbox' }} />
      </Tab.Navigator>
    );
  };
  return (
    <Stack.Navigator initialRouteName={token ? 'Home' : 'Login'} screenOptions={{ headerShown: false }}>
      {!token ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={AuthedTabs} />
          <Stack.Screen name="NoticeDetail" component={NoticeDetailScreen} />
          <Stack.Screen name="EditNotice" component={EditNoticeScreen} />
          <Stack.Screen name="CreateNotice" component={CreateNoticeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="FacultyList" component={FacultyListScreen} />
          <Stack.Screen name="StudentList" component={StudentListScreen} />
          <Stack.Screen name="AdminUserList" component={AdminUserListScreen} />
          <Stack.Screen name="AdminUserEdit" component={AdminUserEditScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="Friends" component={FriendsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Domine_700Bold, Inter_400Regular, Inter_600SemiBold });
  if (!fontsLoaded) return null;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 24,
        retry: 1,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
      },
    },
  });
  const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'rq-cache' });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24,
  });
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <Router />
            </NavigationContainer>
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
