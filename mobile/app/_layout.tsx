import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import { PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/context/AuthContext";
import { GameConfigProvider } from "@/context/GameConfigContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { routeForNotification } from "@/services/notificationService";

// Se mantiene el splash nativo hasta que carguen las tipografías: sin esto se
// vería un parpadeo con la fuente del sistema.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    PressStart2P_400Regular,
    VT323_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <GameConfigProvider>
              <ThemedStack />
            </GameConfigProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { colors } = useTheme();

  // Al tocar una notificación push se abre la pantalla correspondiente.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotification(response.notification.request.content.data as Record<string, unknown>);
      if (route) router.push(route as never);
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          // Sin cabecera nativa: cada pantalla dibuja la carcasa del aparato
          // (`DexScreen`) con su título pixelado y su botón de volver.
          headerShown: false,
          contentStyle: { backgroundColor: colors.shell },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="fishdex/[fishId]" options={{ headerShown: false }} />
        <Stack.Screen name="catch/create" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="catch/camera" options={{ headerShown: false }} />
        <Stack.Screen name="capture/[id]" options={{ title: "Captura" }} />
        <Stack.Screen name="friends/requests" options={{ title: "Solicitudes" }} />
        <Stack.Screen name="friends/[userId]" options={{ title: "Perfil" }} />
        <Stack.Screen name="ranking/index" options={{ title: "Ranking" }} />
        <Stack.Screen name="challenges/new" options={{ title: "Nuevo reto", presentation: "modal" }} />
        <Stack.Screen name="challenges/[id]" options={{ title: "Reto" }} />
        <Stack.Screen name="spots/[id]" options={{ title: "Spot" }} />
        <Stack.Screen name="settings/index" options={{ title: "Ajustes" }} />
        <Stack.Screen name="stats/index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
