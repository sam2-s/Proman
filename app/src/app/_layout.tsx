import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../context/auth';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
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
            name="task/[id]"
            options={{ presentation: 'modal', title: 'Task' }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
