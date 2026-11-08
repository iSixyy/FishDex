import { api } from "@/services/api";
import { appendImage } from "@/services/imageService";
import { saveToken, setCache } from "@/services/storageService";
import { STORAGE_KEYS } from "@/constants/config";
import { AuthResponse, FishingLicense, ReportReason, ReportTarget, User, UserProfile } from "@/types";

/** Guarda el token nuevo que devuelve el backend al cambiar o recuperar la
 * contraseña (las demás sesiones quedan cerradas). */
async function persist(auth: AuthResponse): Promise<User> {
  await saveToken(auth.access_token);
  await setCache(STORAGE_KEYS.AUTH_USER, auth.user);
  return auth.user;
}

// ---------------------------------------------------------------- perfil
export async function updateProfile(changes: { display_name?: string }): Promise<UserProfile> {
  const { data } = await api.patch<UserProfile>("/users/me", changes);
  return data;
}

export async function uploadAvatar(imageUri: string): Promise<UserProfile> {
  const form = new FormData();
  await appendImage(form, imageUri, "avatar.jpg");
  const { data } = await api.post<UserProfile>("/users/me/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return data;
}

export async function removeAvatar(): Promise<UserProfile> {
  const { data } = await api.delete<UserProfile>("/users/me/avatar");
  return data;
}

// ---------------------------------------------------------------- contraseña
export async function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  const { data } = await api.post<AuthResponse>("/auth/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return persist(data);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/password/forgot", { email });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<User> {
  const { data } = await api.post<AuthResponse>("/auth/password/reset", { email, code, new_password: newPassword });
  return persist(data);
}

// ---------------------------------------------------------------- baja
export async function deleteAccount(password: string): Promise<void> {
  await api.delete("/users/me", { data: { password } });
}

// ---------------------------------------------------------------- licencia
export async function getLicense(): Promise<FishingLicense> {
  const { data } = await api.get<FishingLicense>("/users/me/license");
  return data;
}

export async function saveLicense(expiresOn: string | null, region: string | null): Promise<FishingLicense> {
  const { data } = await api.put<FishingLicense>("/users/me/license", { expires_on: expiresOn, region });
  return data;
}

// ---------------------------------------------------------------- moderación
export async function blockUser(userId: number): Promise<void> {
  await api.post(`/users/${userId}/block`);
}

export async function unblockUser(userId: number): Promise<void> {
  await api.delete(`/users/${userId}/block`);
}

export async function getBlockedUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>("/users/me/blocked");
  return data;
}

export async function report(target: ReportTarget, targetId: number, reason: ReportReason, details?: string): Promise<void> {
  await api.post("/reports", { target_type: target, target_id: targetId, reason, details: details || null });
}
