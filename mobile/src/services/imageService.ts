import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";

const MAX_DIMENSION = 1600;
const COMPRESSION_QUALITY = 0.8;

/** Directorio persistente (no caché) donde se copian las fotos de capturas
 * que se encolan para sincronizar más tarde. `ImageManipulator.manipulateAsync`
 * guarda su resultado en el directorio de caché del SO, que el sistema puede
 * vaciar en cualquier momento; si una captura tarda días en sincronizarse
 * (offline prolongado) la foto podría haber desaparecido para entonces. */
const PENDING_DIR = `${FileSystem.documentDirectory}pending/`;

async function ensurePendingDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PENDING_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true });
  }
}

function generateFileName(): string {
  if (typeof Crypto.randomUUID === "function") {
    return Crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Copia la imagen (normalmente en el directorio de caché tras comprimirla)
 * a un directorio persistente propio de la app, para que sobreviva aunque
 * el SO libere caché mientras la captura espera en la cola offline.
 * Si algo falla, devuelve el uri original en vez de romper el encolado:
 * es mejor arriesgarse a perder la foto que perder toda la captura. */
export async function persistImageForQueue(uri: string): Promise<string> {
  try {
    await ensurePendingDir();
    const destination = `${PENDING_DIR}${generateFileName()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return uri;
  }
}

/** Borra una foto persistida para la cola una vez la captura se ha
 * sincronizado (o se ha descartado permanentemente). Solo borra archivos
 * dentro de nuestro `documentDirectory`: nunca archivos de la galería del
 * usuario ni de otras apps. */
export async function deletePersistedImage(uri: string | null | undefined): Promise<void> {
  if (!uri) return;
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory || !uri.startsWith(documentDirectory)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Si no se puede borrar (ya no existe, permisos, etc.) no es crítico.
  }
}

/** Reescala y comprime una foto (JPEG, lado mayor <= 1600px, calidad 0.8).
 * Se usa tanto tras `takePhoto`/`pickFromGallery` como tras disparar con la
 * cámara propia de `/catch/camera`, para que el peso de la imagen final sea
 * siempre el mismo independientemente de cómo se haya obtenido. */
export async function compress(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    allowsEditing: true,
    aspect: [4, 3],
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return compress(result.assets[0].uri);
}

export async function pickFromGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    allowsEditing: true,
    aspect: [4, 3],
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return compress(result.assets[0].uri);
}

export function buildImageFormPart(uri: string) {
  // compress() siempre devuelve un JPEG (SaveFormat.JPEG), así que el tipo
  // MIME y el nombre se fuerzan en vez de derivarse de la extensión original
  // del uri (que en algunos dispositivos puede ser .heic, .png, etc.).
  return {
    uri,
    name: "captura.jpg",
    type: "image/jpeg",
  } as unknown as Blob;
}
