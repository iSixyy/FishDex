import { api } from "@/services/api";
import { Challenge, ChallengeCriterion } from "@/types";

export const CRITERION_OPTIONS: { value: ChallengeCriterion; label: string }[] = [
  { value: "HEAVIEST", label: "Pieza más pesada" },
  { value: "LONGEST", label: "Pieza más larga" },
  { value: "MOST_CAPTURES", label: "Más capturas" },
  { value: "MOST_SPECIES", label: "Más especies" },
];

export async function getChallenges(): Promise<Challenge[]> {
  const { data } = await api.get<Challenge[]>("/challenges");
  return data;
}

export async function getChallenge(id: number): Promise<Challenge> {
  const { data } = await api.get<Challenge>(`/challenges/${id}`);
  return data;
}

export interface ChallengeInput {
  criterion: ChallengeCriterion;
  duration_days: number;
  species_id: number | null;
  title: string | null;
}

/** Un amigo = reto 1 contra 1; varios = torneo. */
export async function createChallenge(friendIds: number[], input: ChallengeInput): Promise<Challenge> {
  const { data } = await api.post<Challenge>("/challenges", { ...input, friend_ids: friendIds });
  return data;
}

export async function createEvent(input: ChallengeInput & { title: string }): Promise<Challenge> {
  const { data } = await api.post<Challenge>("/challenges/events", input);
  return data;
}

export async function respondChallenge(id: number, accept: boolean): Promise<Challenge> {
  const { data } = await api.post<Challenge>(`/challenges/${id}/respond`, { accept });
  return data;
}

export async function joinEvent(id: number): Promise<Challenge> {
  const { data } = await api.post<Challenge>(`/challenges/${id}/join`);
  return data;
}

export async function cancelChallenge(id: number): Promise<void> {
  await api.delete(`/challenges/${id}`);
}
