import { DarkTheme, router, Stack, ThemeProvider, type Theme } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Platform, Pressable } from 'react-native';
import { WebFrame } from '@/components/web/WebFrame';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accentPink,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.accentPink,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
    <SafeAreaProvider>
      <WebFrame>
      <ThemeProvider value={navigationTheme}>
        <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: colors.text,
              headerStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
              // Web: quem abre um link direto (ex.: /post/123 pelo WhatsApp) não tem histórico —
              // mostramos um "voltar" que leva ao início.
              headerLeft: Platform.OS === 'web' ? ({ canGoBack }) => (canGoBack ? undefined : <HomeBack />) : undefined,
              animationDuration: 260,
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="post/[id]" options={{ headerShown: true, title: 'Publicação' }} />
            <Stack.Screen name="u/[username]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="compose" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="report/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notificações' }} />
            <Stack.Screen name="settings" options={{ headerShown: true, title: 'Editar perfil', presentation: 'modal' }} />
            <Stack.Screen name="suggest" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="moderation" options={{ headerShown: true, title: 'Moderação' }} />
            <Stack.Screen name="review/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Avaliar rolê' }} />
            <Stack.Screen name="reputation" options={{ headerShown: true, title: 'Reputação', presentation: 'modal' }} />
            <Stack.Screen name="design-system" options={{ headerShown: true, title: 'Design system', presentation: 'modal' }} />
          </Stack>
        </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
      </WebFrame>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function HomeBack() {
  return (
    <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Ir para o início" hitSlop={12} style={{ paddingHorizontal: 8 }}>
      <ChevronLeft size={24} color={colors.text} />
    </Pressable>
  );
}
