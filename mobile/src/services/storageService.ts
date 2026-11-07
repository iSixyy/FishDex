import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Persistencia local. El token va en SecureStore (cifrado); el resto de
 * caché offline (FishDex, capturas, config) va en AsyncStorage.
 *
 * SecureStore no existe en web: en la vista previa del navegador el token se
 * guarda en AsyncStorage (localStorage). En Android/iOS no cambia nada. */
const TOKEN_KEY = "auth_token";
const isWeb = Platform.OS === "web";

export async function saveToken(token: string): Promise<void> {
  if (isWeb) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return isWeb ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  if (isWeb) await AsyncStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function removeCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
