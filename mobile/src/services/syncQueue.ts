import axios from "axios";

import { CAPTURE_UPLOAD_TIMEOUT_MS, STORAGE_KEYS } from "@/constants/config";
import { api } from "@/services/api";
import { buildImageFormPart, deletePersistedImage } from "@/services/imageService";
import { getCache, getToken, setCache } from "@/services/storageService";
import { DiscardedCapture, PendingCapture, User } from "@/types";

/** Cola de sincronización offline:
 *   Local DB (AsyncStorage) -> Sync Queue -> Backend
 * Las capturas creadas sin conexión se guardan aquí y se reintentan
 * cuando vuelve la conexión (o manualmente desde Ajustes). */

export async function getQueue(): Promise<PendingCapture[]> {
  return (await getCache<PendingCapture[]>(STORAGE_KEYS.SYNC_QUEUE)) ?? [];
}

async function saveQueue(queue: PendingCapture[]): Promise<void> {
  await setCache(STORAGE_KEYS.SYNC_QUEUE, queue);
}

/** Cadena de promesas que serializa el acceso de lectura-modificación-escritura
 * a la cola: cada llamada se encadena tras la anterior (independientemente de
 * si esta tuvo éxito o falló) para que dos encolados/desencolados simultáneos
 * no se pisen entre sí. */
let queueLock: Promise<void> = Promise.resolve();

function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueLock.then(fn, fn);
  queueLock = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function enqueueCapture(capture: PendingCapture): Promise<void> {
  await withQueueLock(async () => {
    const queue = await getQueue();
    queue.push(capture);
    await saveQueue(queue);
  });
}

async function removeFromQueue(localId: string): Promise<void> {
  await withQueueLock(async () => {
    const queue = await getQueue();
    await saveQueue(queue.filter((item) => item.localId !== localId));
  });
}

export async function getDiscardedCaptures(): Promise<DiscardedCapture[]> {
  return (await getCache<DiscardedCapture[]>(STORAGE_KEYS.SYNC_DISCARDED)) ?? [];
}

export async function clearDiscardedCaptures(): Promise<void> {
  await setCache(STORAGE_KEYS.SYNC_DISCARDED, []);
}

async function addDiscardedCapture(capture: PendingCapture, reason: string): Promise<void> {
  const discarded = await getDiscardedCaptures();
  discarded.push({ capture, reason, discarded_at: new Date().toISOString() });
  await setCache(STORAGE_KEYS.SYNC_DISCARDED, discarded);
}

/** Resultado de intentar sincronizar una única captura pendiente:
 *  - "ok": el backend la ha aceptado.
 *  - "retry": fallo transitorio (sin conexión real, 5xx, etc.); se queda en la cola.
 *  - "permanent": el backend la ha rechazado de forma permanente (datos inválidos,
 *    captura demasiado antigua, etc.); reintentar no serviría de nada, así que se
 *    saca de la cola y se archiva como descartada.
 *  - "unauthorized": 401, la sesión ha caducado. La captura es válida: se queda
 *    en la cola hasta que el usuario vuelva a iniciar sesión. Antes el 401 se
 *    trataba como permanente y quien pasaba más de 7 días sin conexión (lo que
 *    dura el token) perdía TODAS sus capturas pendientes al reconectar. */
export type SyncOutcome = "ok" | "retry" | "permanent" | "unauthorized";

/** Códigos HTTP ante los que no tiene sentido reintentar: la petición está
 * mal formada o rechazada por reglas de negocio del backend (p.ej. 422 cuando
 * `captured_at` supera la antigüedad máxima permitida). El 401 NO está aquí. */
const PERMANENT_STATUS_CODES = new Set([400, 403, 404, 409, 413, 422]);

async function syncOne(pending: PendingCapture): Promise<SyncOutcome> {
  const form = new FormData();
  // Mismo id que el envío original: si ya llegó al servidor (y solo se perdió
  // la respuesta), el backend devuelve la captura existente en vez de duplicarla.
  form.append("client_id", pending.localId);
  form.append("fish_species_id", String(pending.fish_species_id));
  form.append("weight_kg", String(pending.weight_kg));
  form.append("length_cm", String(pending.length_cm));
  form.append("captured_at", pending.captured_at);
  if (pending.latitude != null) form.append("latitude", String(pending.latitude));
  if (pending.longitude != null) form.append("longitude", String(pending.longitude));
  if (pending.location_name) form.append("location_name", pending.location_name);
  if (pending.bait_technique) form.append("bait_technique", pending.bait_technique);
  if (pending.image_uri) {
    form.append("image", buildImageFormPart(pending.image_uri) as unknown as Blob, "captura.jpg");
  }

  try {
    await api.post("/captures", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: CAPTURE_UPLOAD_TIMEOUT_MS,
    });
    return "ok";
  } catch (error) {
    if (!axios.isAxiosError(error)) return "retry";
    if (!error.response) {
      // Sin respuesta del servidor: timeout, DNS, sin red real. Reintentable.
      return "retry";
    }
    if (error.response.status === 401) {
      return "unauthorized";
    }
    if (PERMANENT_STATUS_CODES.has(error.response.status)) {
      return "permanent";
    }
    // 5xx y cualquier otro código no contemplado: se asume transitorio.
    return "retry";
  }
}

function reasonForDiscard(): string {
  // El motivo exacto (422 vs 404, etc.) no se propaga fuera de syncOne para
  // mantener la firma simple; se guarda un motivo genérico pero útil.
  return "El servidor ha rechazado esta captura de forma permanente (datos inválidos o captura demasiado antigua) y no se volverá a reintentar.";
}

/** Evita invocaciones concurrentes de trySyncQueue (p.ej. si useAutoSync
 * dispara el evento de reconexión dos veces seguidas), lo que provocaría
 * capturas duplicadas al leer/enviar la misma cola dos veces en paralelo. */
let syncing = false;

export type SyncReport =
  | { status: "already_syncing" }
  | { status: "done"; synced: number; discarded: number; pending: number };

/** Intenta sincronizar todas las capturas pendientes.
 *
 * Nota: la cola se lee una única vez al principio (instantánea). Las
 * capturas que se encolen mientras este bucle está en marcha (por ejemplo,
 * si el usuario registra una nueva captura offline durante la sincronización)
 * no se incluyen en esta pasada; se sincronizarán en la siguiente llamada a
 * trySyncQueue. Es una limitación aceptada. */
export async function trySyncQueue(): Promise<SyncReport> {
  if (syncing) return { status: "already_syncing" };
  syncing = true;
  try {
    // Sin sesión no hay nada que hacer: cada envío acabaría en 401.
    if (!(await getToken())) {
      return { status: "done", synced: 0, discarded: 0, pending: await queueLength() };
    }
    const currentUser = await getCache<User>(STORAGE_KEYS.AUTH_USER);
    const queue = await getQueue();
    let synced = 0;
    let discarded = 0;
    for (const pending of queue) {
      // Capturas de otra cuenta (quedaron en la cola antes de cerrar sesión):
      // se conservan para cuando esa cuenta vuelva, nunca se suben con esta.
      if (pending.user_id != null && currentUser && pending.user_id !== currentUser.id) continue;
      const outcome = await syncOne(pending);
      if (outcome === "unauthorized") break; // sesión caducada: se reintentará tras el login
      if (outcome === "ok") {
        await removeFromQueue(pending.localId);
        await deletePersistedImage(pending.image_uri);
        synced += 1;
      } else if (outcome === "permanent") {
        await removeFromQueue(pending.localId);
        await addDiscardedCapture(pending, reasonForDiscard());
        await deletePersistedImage(pending.image_uri);
        discarded += 1;
      }
      // "retry": se queda en la cola tal cual, sin tocar.
    }
    const remaining = await queueLength();
    return { status: "done", synced, discarded, pending: remaining };
  } finally {
    syncing = false;
  }
}

export async function queueLength(): Promise<number> {
  return (await getQueue()).length;
}
