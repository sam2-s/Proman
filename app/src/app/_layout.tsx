import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/auth';
import { font } from '../theme';
import { ThemeProvider, useTheme } from '../theme/Theme';

function RootStack() {
  const colors = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: font.mono,
          fontSize: 14,
          fontWeight: '700',
          color: colors.text,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen
        name="projects"
        options={{ title: 'Projects', headerShown: false }}
      />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="admin" options={{ title: 'Admin' }} />
      <Stack.Screen name="board/[id]" options={{ title: 'Board' }} />
      <Stack.Screen
        name="project/[id]/timeline"
        options={{ title: 'Timeline' }}
      />
      <Stack.Screen
        name="project/[id]/calendar"
        options={{ title: 'Calendar' }}
      />
      <Stack.Screen
        name="project/[id]/members"
        options={{ title: 'Members' }}
      />
      <Stack.Screen
        name="project/[id]/activity"
        options={{ title: 'Activity' }}
      />
      <Stack.Screen
        name="search"
        options={{ title: 'Search', presentation: 'modal' }}
      />
      <Stack.Screen
        name="notifications"
        options={{ title: 'Notifications', presentation: 'modal' }}
      />
      <Stack.Screen
        name="task/[id]"
        options={{ presentation: 'modal', title: 'Task' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
