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

export async function logout(): Promise<void> {
  await clearToken();
  await removeCache(STORAGE_KEYS.AUTH_USER);
}

export async function getCachedUser(): Promise<User | null> {
  return getCache<User>(STORAGE_KEYS.AUTH_USER);
}
