import { api } from "@/services/api";
import { FriendsRanking, RankingPage, SeasonPage } from "@/types";

export const RANKING_PAGE_SIZE = 50;

export async function getFriendsRanking(): Promise<FriendsRanking> {
  const { data } = await api.get<FriendsRanking>("/ranking/friends");
  return data;
}

export async function getGlobalRanking(offset = 0): Promise<RankingPage> {
  const { data } = await api.get<RankingPage>("/ranking/global", { params: { limit: RANKING_PAGE_SIZE, offset } });
  return data;
}

export async function getRegions(): Promise<string[]> {
  const { data } = await api.get<string[]>("/ranking/regions");
  return data;
}

export async function getRegionRanking(community: string, offset = 0): Promise<RankingPage> {
  const { data } = await api.get<RankingPage>(`/ranking/region/${encodeURIComponent(community)}`, {
    params: { limit: RANKING_PAGE_SIZE, offset },
  });
  return data;
}

export async function getSpeciesRanking(speciesId: number, offset = 0): Promise<RankingPage> {
  const { data } = await api.get<RankingPage>(`/ranking/species/${speciesId}`, {
    params: { limit: RANKING_PAGE_SIZE, offset },
  });
  return data;
}

/** Temporada en curso: ranking trimestral que se reinicia cada 3 meses. */
export async function getCurrentSeason(offset = 0): Promise<SeasonPage> {
  const { data } = await api.get<SeasonPage>("/seasons/current", { params: { limit: RANKING_PAGE_SIZE, offset } });
  return data;
}
