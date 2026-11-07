import { api } from "@/services/api";
import { CaptureComment, FeedEntry } from "@/types";

export type FeedScope = "highlights" | "friends";

/** Feed de Comunidad: capturas destacadas o solo de amigos, paginado. */
export async function getFeed(scope: FeedScope, limit = 20, offset = 0): Promise<FeedEntry[]> {
  const { data } = await api.get<FeedEntry[]>("/feed", { params: { scope, limit, offset } });
  return data;
}

export async function likeCapture(captureId: number): Promise<void> {
  await api.post(`/captures/${captureId}/like`);
}

export async function unlikeCapture(captureId: number): Promise<void> {
  await api.delete(`/captures/${captureId}/like`);
}

export async function getCaptureComments(captureId: number): Promise<CaptureComment[]> {
  const { data } = await api.get<CaptureComment[]>(`/captures/${captureId}/comments`);
  return data;
}

export async function postCaptureComment(captureId: number, text: string): Promise<CaptureComment> {
  const { data } = await api.post<CaptureComment>(`/captures/${captureId}/comments`, { text });
  return data;
}
