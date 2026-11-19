import { Archivo_700Bold, Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Toaster } from '@/components/ui/toast';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg.base,
    card: colors.bg.surface,
    border: colors.border.default,
    primary: colors.brand.red,
    text: colors.text.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { ready, signedIn, termsAccepted, profileComplete, init } = useSession();

  // Escuta a sessão (Supabase ou modo demonstração) — US-02, cenário 5
  useEffect(() => init(), [init]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const inApp = ready && signedIn && termsAccepted;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }}>
            {/* Sempre disponíveis: splash, documentos legais e redefinição de senha */}
            <Stack.Screen name="index" />
            <Stack.Screen name="documento/[tipo]" />
            <Stack.Screen name="nova-senha" />

            {/* RN-001: sem sessão, só acesso */}
            <Stack.Protected guard={ready && !signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>

            {/* RN-005: termos novos bloqueiam o app até o aceite (US-03, cenário 2) */}
            <Stack.Protected guard={ready && signedIn && !termsAccepted}>
              <Stack.Screen name="termos" options={{ gestureEnabled: false }} />
            </Stack.Protected>

            {/* RN-006: perfil mínimo + academia antes da descoberta */}
            <Stack.Protected guard={inApp && !profileComplete}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>

            {/* Sugerir academia: no onboarding (P7/P8) e a partir de Minha academia */}
            <Stack.Protected guard={inApp}>
              <Stack.Screen name="sugerir-academia" />
            </Stack.Protected>

            <Stack.Protected guard={inApp && profileComplete}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="perfil/[id]" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="match" options={{ presentation: 'transparentModal', animation: 'fade' }} />
              <Stack.Screen name="filtros" options={{ presentation: 'modal' }} />
              <Stack.Screen name="notificacoes" />
              <Stack.Screen name="minha-academia" />
              <Stack.Screen name="buscar-academia" />
              <Stack.Screen name="preferencias" />
              <Stack.Screen name="ranking" />
              <Stack.Screen name="editar-perfil" />
              <Stack.Screen name="configuracoes" />
              <Stack.Screen name="bloqueados" />
              <Stack.Screen name="comentarios/[id]" />
              <Stack.Screen name="calendario" />
              <Stack.Screen name="treinos" />
              <Stack.Screen
                name="dia-concluido"
                options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false }}
              />
            </Stack.Protected>
          </Stack>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
