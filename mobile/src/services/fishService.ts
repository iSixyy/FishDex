import { STORAGE_KEYS } from "@/constants/config";
import { api } from "@/services/api";
import { getCache, setCache } from "@/services/storageService";
import { FishCatalogEntry, FishDexProgress, FishSpeciesDetail } from "@/types";

/** Consulta la FishDex online y cachea el resultado para uso offline. */
export async function getFishDex(): Promise<FishDexProgress> {
  try {
    const { data } = await api.get<FishDexProgress>("/fish");
    await setCache(STORAGE_KEYS.FISHDEX_CACHE, data);
    return data;
  } catch (error) {
    const cached = await getCache<FishDexProgress>(STORAGE_KEYS.FISHDEX_CACHE);
    if (cached) return cached;
    throw error;
  }
}

export async function getSpeciesDetail(speciesId: number): Promise<FishSpeciesDetail> {
  const { data } = await api.get<FishSpeciesDetail>(`/fish/${speciesId}`);
  return data;
}

/** Catálogo completo (con nombre) para el selector de especie al capturar. */
export async function getSpeciesCatalog(): Promise<FishCatalogEntry[]> {
  const cacheKey = `${STORAGE_KEYS.FISHDEX_CACHE}.catalog`;
  try {
    const { data } = await api.get<FishCatalogEntry[]>("/fish/catalog");
    await setCache(cacheKey, data);
    return data;
  } catch (error) {
    const cached = await getCache<FishCatalogEntry[]>(cacheKey);
    if (cached) return cached;
    throw error;
  }
}
