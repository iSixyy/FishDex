import { api } from "@/services/api";
import { AchievementPublic, UserProfile } from "@/types";

/** Perfil del usuario autenticado (datos de cuenta + estadísticas agregadas). */
export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>("/users/me");
  return data;
}

/** Perfil de un amigo (incluye su vitrina de insignias). */
export async function getUserProfile(userId: number): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>(`/users/${userId}`);
  return data;
}

export async function getUserAchievements(userId: number): Promise<AchievementPublic[]> {
  const { data } = await api.get<AchievementPublic[]>(`/users/${userId}/achievements`);
  return data;
}

/** Elige hasta 3 insignias para la vitrina (vacío = automática). */
export async function updateShowcase(codes: string[]): Promise<UserProfile> {
  const { data } = await api.put<UserProfile>("/users/me/showcase", { codes });
  return data;
}
