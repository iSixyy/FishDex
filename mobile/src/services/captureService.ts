import axios from "axios";
import * as Crypto from "expo-crypto";

import { CAPTURE_UPLOAD_TIMEOUT_MS, STORAGE_KEYS } from "@/constants/config";
import { api, extractErrorMessage } from "@/services/api";
import { buildImageFormPart, persistImageForQueue } from "@/services/imageService";
import { getCache, setCache } from "@/services/storageService";
import { enqueueCapture } from "@/services/syncQueue";
import { CapturePublic, CaptureResult, MapCapturePin, PendingCapture, User } from "@/types";

/** Máximo que admite `GET /captures` por página (`le=500` en el backend). */
const CAPTURES_PAGE_SIZE = 500;

export interface CreateCaptureInput {
  fish_species_id: number;
  weight_kg: number;
  length_cm: number;
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  bait_technique: string | null;
  image_uri: string | null;
}

export type CreateCaptureOutcome =
  | { status: "synced"; result: CaptureResult }
  | { status: "queued" };

/** Genera un id local único para identificar la captura en la cola de
 * sincronización offline. Se usa expo-crypto en vez de Date.now() + Math.random(),
 * que puede colisionar si se registran varias capturas en el mismo instante. */
function generateLocalId(): string {
  if (typeof Crypto.randomUUID === "function") {
    return Crypto.randomUUID();
  }
  // Fallback por si randomUUID no está disponible en el runtime (versiones
  // antiguas de Expo/JSC sin soporte).
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Registra una captura. Si no hay conexión, se guarda en la cola de
 * sincronización local y se avisa al usuario en vez de fallar. El ELO
 * NUNCA se calcula en el cliente: si se encola, se calculará al sincronizar. */
export async function createCapture(input: CreateCaptureInput): Promise<CreateCaptureOutcome> {
  // El mismo id viaja como `client_id` en el envío directo y, si este falla
  // por red, en todos los reintentos de la cola: el backend lo usa para no
  // registrar dos veces la misma captura si la primera respuesta se perdió.
  const localId = generateLocalId();
  const form = new FormData();
  form.append("client_id", localId);
  form.append("fish_species_id", String(input.fish_species_id));
  form.append("weight_kg", String(input.weight_kg));
  form.append("length_cm", String(input.length_cm));
  form.append("captured_at", input.captured_at);
  if (input.latitude != null) form.append("latitude", String(input.latitude));
  if (input.longitude != null) form.append("longitude", String(input.longitude));
  if (input.location_name) form.append("location_name", input.location_name);
  if (input.bait_technique) form.append("bait_technique", input.bait_technique);
  if (input.image_uri) {
    form.append("image", buildImageFormPart(input.image_uri) as unknown as Blob, "captura.jpg");
  }

  try {
    const { data } = await api.post<CaptureResult>("/captures", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: CAPTURE_UPLOAD_TIMEOUT_MS,
    });
    return { status: "synced", result: data };
  } catch (error) {
    if (isNetworkError(error)) {
      // La foto comprimida vive en el directorio de caché del SO, que puede
      // vaciarse en cualquier momento. Como la captura puede tardar días en
      // sincronizarse (offline prolongado), la copiamos a un directorio
      // persistente antes de guardarla en la cola.
      const persistedImageUri = input.image_uri ? await persistImageForQueue(input.image_uri) : null;
      const owner = await getCache<User>(STORAGE_KEYS.AUTH_USER);
      const pending: PendingCapture = {
        localId,
        user_id: owner?.id ?? null,
        ...input,
        image_uri: persistedImageUri,
        created_at: new Date().toISOString(),
      };
      await enqueueCapture(pending);
      return { status: "queued" };
    }
    throw new Error(extractErrorMessage(error));
  }
}

/** Solo se considera "sin conexión" cuando axios no ha recibido respuesta
 * alguna del servidor (timeout, DNS, sin red). Un error HTTP real (4xx/5xx)
 * se propaga como error normal en vez de encolarse silenciosamente. */
function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** TODAS las capturas propias (opcionalmente de una especie). El backend
 * pagina (100 por defecto, 500 como máximo): pedir solo la primera página
 * dejaba fuera las más antiguas y falseaba los totales de Estadísticas y
 * Perfil en cuanto un usuario pasaba de 100 capturas. */
export async function getMyCaptures(speciesId?: number): Promise<CapturePublic[]> {
  const data: CapturePublic[] = [];
  for (let offset = 0; ; offset += CAPTURES_PAGE_SIZE) {
    const { data: page } = await api.get<CapturePublic[]>("/captures", {
      params: {
        limit: CAPTURES_PAGE_SIZE,
        offset,
        ...(speciesId !== undefined ? { species_id: speciesId } : {}),
      },
    });
    data.push(...page);
    if (page.length < CAPTURES_PAGE_SIZE) break;
  }
  // Solo se cachea bajo CAPTURES_CACHE ("todas mis capturas") cuando no se
  // ha filtrado por especie; si no, una lista filtrada pisaría la caché de
  // la lista completa y getCachedCaptures() devolvería datos incompletos.
  if (speciesId === undefined) {
    await setCache(STORAGE_KEYS.CAPTURES_CACHE, data);
  }
  return data;
}

export async function getCachedCaptures(): Promise<CapturePublic[]> {
  return (await getCache<CapturePublic[]>(STORAGE_KEYS.CAPTURES_CACHE)) ?? [];
}

/** Capturas propias con ubicación, para los pines del mapa. */
export async function getMapCaptures(): Promise<MapCapturePin[]> {
  const { data } = await api.get<MapCapturePin[]>("/map/captures");
  return data;
}

export async function getCapture(id: number): Promise<CapturePublic> {
  const { data } = await api.get<CapturePublic>(`/captures/${id}`);
  return data;
}

export interface CaptureChanges {
  fish_species_id?: number;
  weight_kg?: number;
  length_cm?: number;
  location_name?: string | null;
  bait_technique?: string | null;
}

/** Corrige una captura. El servidor recalcula el ELO de todo el historial. */
export async function updateCapture(id: number, changes: CaptureChanges): Promise<CapturePublic> {
  const { data } = await api.patch<CapturePublic>(`/captures/${id}`, changes);
  return data;
}

export async function deleteCapture(id: number): Promise<void> {
  await api.delete(`/captures/${id}`);
}
