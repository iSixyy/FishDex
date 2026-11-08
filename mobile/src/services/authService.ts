import { api } from "@/services/api";
import { clearToken, getCache, removeCache, saveToken, setCache } from "@/services/storageService";
import { STORAGE_KEYS } from "@/constants/config";
import { AuthResponse, User } from "@/types";

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  display_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

async function persistSession(auth: AuthResponse): Promise<void> {
  await saveToken(auth.access_token);
  await setCache(STORAGE_KEYS.AUTH_USER, auth.user);
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  await persistSession(data);
  return data.user;
}

export async function login(payload: LoginPayload): Promise<User> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  await persistSession(data);
  return data.user;
}

/** Cachés con datos de la cuenta. Antes solo se borraba el usuario: la
 * FishDex, las capturas y los favoritos del anterior se quedaban en el móvil
 * y, sin conexión, la siguiente cuenta que entraba veía los suyos. La cola
 * de sincronización NO se borra: cada captura pendiente lleva su `user_id` y
 * se sube cuando su dueño vuelve a entrar. */
const ACCOUNT_CACHE_KEYS = [
  STORAGE_KEYS.AUTH_USER,
  STORAGE_KEYS.FISHDEX_CACHE,
  STORAGE_KEYS.CAPTURES_CACHE,
  STORAGE_KEYS.FAVOURITES,
] as const;

/** Cierra la sesión en el dispositivo. Con `revokeOnServer` (cierre de
 * sesión pedido por el usuario) también invalida el token en el backend; si
 * la sesión ya ha caducado (401) no tiene sentido intentarlo. */
export async function logout({ revokeOnServer = true }: { revokeOnServer?: boolean } = {}): Promise<void> {
  if (revokeOnServer) {
    try {
      await api.post("/auth/logout");
    } catch {
      // Sin red: el token caducará solo; localmente la sesión se cierra igual.
    }
  }
  await clearToken();
  await Promise.all(ACCOUNT_CACHE_KEYS.map((key) => removeCache(key).catch(() => undefined)));
}

export async function getCachedUser(): Promise<User | null> {
  return getCache<User>(STORAGE_KEYS.AUTH_USER);
}
