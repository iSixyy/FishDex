import { STORAGE_KEYS } from "@/constants/config";
import { api } from "@/services/api";
import { getCache, setCache } from "@/services/storageService";
import { GameConfig } from "@/types";

/** La configuración de ELO/rangos SIEMPRE viene del backend (nunca se
 * hardcodea en la UI). Se cachea para poder mostrarla offline. */
export async function getGameConfig(): Promise<GameConfig> {
  try {
    const { data } = await api.get<GameConfig>("/config");
    await setCache(STORAGE_KEYS.GAME_CONFIG_CACHE, data);
    return data;
  } catch (error) {
    const cached = await getCache<GameConfig>(STORAGE_KEYS.GAME_CONFIG_CACHE);
    if (cached) return cached;
    throw error;
  }
}
