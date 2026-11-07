import { Redirect, router, Tabs } from "expo-router";
import React, { useEffect } from "react";

import { FishDexTabBar } from "@/components/FishDexTabBar";
import { DexScreen } from "@/components/DexScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/context/AuthContext";
import { useAutoSync } from "@/hooks/useAutoSync";
import { registerForPushNotifications } from "@/services/notificationService";

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  useAutoSync();

  // Con sesión iniciada, se registra el móvil para recibir notificaciones push.
  useEffect(() => {
    if (user) registerForPushNotifications().catch(() => undefined);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <DexScreen title="FishDex"><LoadingScreen /></DexScreen>;
  if (!user) return <Redirect href="/auth/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FishDexTabBar {...props} />}>
      <Tabs.Screen name="home/index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="fishdex/index" options={{ title: "FishDex" }} />
      <Tabs.Screen
        name="catch"
        options={{ title: "Capturar" }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/catch/create");
          },
        }}
      />
      <Tabs.Screen name="social/index" options={{ title: "Social" }} />
      <Tabs.Screen name="map/index" options={{ title: "Mapa" }} />
      {/* El perfil conserva la barra de pestañas pero se abre desde el avatar
          de la cabecera de Inicio, como en el diseño de referencia. */}
      <Tabs.Screen name="profile/index" options={{ title: "Perfil", href: null }} />
    </Tabs>
  );
}
