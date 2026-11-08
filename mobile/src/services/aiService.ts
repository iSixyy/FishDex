import { api } from "@/services/api";
import { appendImage } from "@/services/imageService";
import { AIIdentifyResponse } from "@/types";

/** El modelo de visión local puede tardar bastante en una CPU modesta. */
const IDENTIFY_TIMEOUT_MS = 120000;

/** Pide a la IA que identifique el pez de la foto y estime peso y longitud.
 * El resultado solo SUGIERE valores: el formulario los deja editables. */
export async function identifyFish(imageUri: string): Promise<AIIdentifyResponse> {
  const form = new FormData();
  await appendImage(form, imageUri, "captura.jpg");
  const { data } = await api.post<AIIdentifyResponse>("/ai/identify", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: IDENTIFY_TIMEOUT_MS,
  });
  return data;
}
