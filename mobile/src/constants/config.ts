import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveApiUrl(): string {
  // En el navegador (`npm run web`) el backend es el de este mismo PC:
  // `EXPO_PUBLIC_API_URL` suele apuntar a 10.0.2.2 (solo válido dentro del
  // emulador de Android) o a la IP de la WiFi para un móvil físico.
  if (Platform.OS === "web") {
    return process.env.EXPO_PUBLIC_WEB_API_URL ?? "http://localhost:8000";
  }
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return fromExtra ?? "http://10.0.2.2:8000";
}

export const API_URL = resolveApiUrl();

/** Subir una foto por datos móviles puede superar el timeout general de 15 s
 * de `api`. Si se cortara antes de que responda el servidor (que ya la ha
 * guardado), la captura se encolaría y se reenviaría; `client_id` evita el
 * duplicado, pero un margen mayor evita el viaje de ida y vuelta. */
export const CAPTURE_UPLOAD_TIMEOUT_MS = 60000;

export const STORAGE_KEYS = {
  AUTH_TOKEN: "fishdex.auth_token",
  AUTH_USER: "fishdex.auth_user",
  FISHDEX_CACHE: "fishdex.dex_cache",
  GAME_CONFIG_CACHE: "fishdex.game_config_cache",
  CAPTURES_CACHE: "fishdex.captures_cache",
  SYNC_QUEUE: "fishdex.sync_queue",
  SYNC_DISCARDED: "fishdex.sync_discarded",
  FAVOURITES: "fishdex.favourites",
} as const;

// Valores de fallback si el backend no responde (offline). Deben coincidir
// con `backend/app/core/game_config.py`; el backend siempre manda cuando
// hay conexión, esto es solo un respaldo local.
export const FALLBACK_RARITY_ORDER: readonly string[] = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
];
