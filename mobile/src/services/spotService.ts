import { api } from "@/services/api";
import { buildImageFormPart } from "@/services/imageService";
import { Spot, WeatherInfo } from "@/types";

export async function getSpots(): Promise<Spot[]> {
  const { data } = await api.get<Spot[]>("/spots");
  return data;
}

export async function getSpot(id: number): Promise<Spot> {
  const { data } = await api.get<Spot>(`/spots/${id}`);
  return data;
}

export async function createSpot(input: {
  name: string;
  notes: string | null;
  latitude: number;
  longitude: number;
}): Promise<Spot> {
  const { data } = await api.post<Spot>("/spots", input);
  return data;
}

export async function updateSpot(id: number, changes: { name?: string; notes?: string | null }): Promise<Spot> {
  const { data } = await api.patch<Spot>(`/spots/${id}`, changes);
  return data;
}

export async function deleteSpot(id: number): Promise<void> {
  await api.delete(`/spots/${id}`);
}

export async function shareSpot(id: number, friendIds: number[]): Promise<Spot> {
  const { data } = await api.put<Spot>(`/spots/${id}/shares`, { friend_ids: friendIds });
  return data;
}

export async function addSpotPhoto(id: number, imageUri: string): Promise<Spot> {
  const form = new FormData();
  form.append("image", buildImageFormPart(imageUri) as unknown as Blob, "spot.jpg");
  const { data } = await api.post<Spot>(`/spots/${id}/photos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return data;
}

export async function deleteSpotPhoto(id: number, photoId: number): Promise<Spot> {
  const { data } = await api.delete<Spot>(`/spots/${id}/photos/${photoId}`);
  return data;
}

export async function getSpotWeather(id: number): Promise<WeatherInfo | null> {
  const { data } = await api.get<Partial<WeatherInfo>>(`/spots/${id}/weather`);
  return data && data.moon ? (data as WeatherInfo) : null;
}
