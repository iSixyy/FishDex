import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/services/api";
import { getCache, removeCache, setCache } from "@/services/storageService";

const PUSH_TOKEN_KEY = "fishdex.push_token";

// Con la app abierta también se muestran (si no, solo llegarían en segundo plano).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Pide permiso, obtiene el token de Expo y lo registra en el backend.
 * Devuelve false (sin lanzar) si no es posible: emulador, permiso denegado
 * o proyecto sin `extra.eas.projectId` (necesario para el token de Expo). */
export async function registerForPushNotifications(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "FishDex",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] Falta extra.eas.projectId en app.json: no se pueden recibir notificaciones push.");
      return false;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post("/devices", { token, platform: Platform.OS });
    await setCache(PUSH_TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** Al cerrar sesión: el móvil deja de recibir avisos de esta cuenta. */
export async function unregisterPushNotifications(): Promise<void> {
  const token = await getCache<string>(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await api.post("/devices/unregister", { token });
  } catch {
    // Sin red: el token seguirá asociado hasta que otra cuenta lo reclame.
  }
  await removeCache(PUSH_TOKEN_KEY);
}

/** Ruta de la app a la que lleva cada tipo de notificación. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  switch (data.type) {
    case "friend_request":
      return "/friends/requests";
    case "friend_accepted":
      return typeof data.user_id === "number" ? `/friends/${data.user_id}` : "/(tabs)/social";
    case "challenge_invite":
    case "challenge_response":
    case "challenge_finished":
    case "challenge_ending":
    case "event":
      return typeof data.challenge_id === "number" ? `/challenges/${data.challenge_id}` : "/(tabs)/social";
    case "record_overtaken":
      return typeof data.species_id === "number" ? `/fishdex/${data.species_id}` : null;
    default:
      return null;
  }
}
