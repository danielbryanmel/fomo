import { DarkTheme, router, Stack, ThemeProvider, type Theme } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Platform } from 'react-native';
import { PressableScale } from '@/components/motion/PressableScale';
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
              // Voltar próprio, igual em todas as telas e plataformas. Sem histórico (link aberto
              // direto pelo WhatsApp), leva ao início em vez de sumir.
              headerLeft: ({ canGoBack }) => <HeaderBack canGoBack={!!canGoBack} />,
              headerTitleStyle: { fontWeight: '700', fontSize: 17 },
              headerTitleAlign: 'center',
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
            <Stack.Screen name="people" options={{ headerShown: true, title: 'Buscar pessoas' }} />
            <Stack.Screen name="connections/[username]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="messages/index" options={{ headerShown: true, title: 'Mensagens' }} />
            <Stack.Screen name="messages/[id]" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="group/new" options={{ headerShown: true, title: 'Novo grupo', presentation: 'modal' }} />
            <Stack.Screen name="group/[id]" options={{ headerShown: true, title: 'Grupo' }} />
            <Stack.Screen name="recap/[username]" options={{ headerShown: true, title: 'Retrospectiva' }} />
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

function HeaderBack({ canGoBack }: { canGoBack: boolean }) {
  return (
    <PressableScale
      onPress={() => (canGoBack ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel={canGoBack ? 'Voltar' : 'Ir para o início'}
      hitSlop={10}
      scaleTo={0.88}
      style={{
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border, marginLeft: Platform.OS === 'web' ? 12 : 0,
      }}
    >
      <ChevronLeft size={22} color={colors.text} style={{ marginLeft: -2 }} />
    </PressableScale>
  );
}
