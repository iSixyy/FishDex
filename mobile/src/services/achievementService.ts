import { api } from "@/services/api";
import { AchievementPublic } from "@/types";

export async function getAchievements(): Promise<AchievementPublic[]> {
  const { data } = await api.get<AchievementPublic[]>("/achievements");
  return data;
}
