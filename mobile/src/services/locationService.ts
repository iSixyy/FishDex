import * as Location from "expo-location";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Pide permiso y obtiene la posición GPS actual. Devuelve null si el
 * usuario deniega el permiso o el GPS falla (la captura sigue pudiendo
 * guardarse sin ubicación). */
export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

/** Traduce unas coordenadas a un nombre de lugar legible ("Localidad,
 * Provincia") para mostrarlo en el paso de ubicación de la captura. Devuelve
 * null si el dispositivo no puede resolver la dirección (sin conexión, sin
 * soporte, etc.): la captura siempre puede guardarse solo con coordenadas. */
export async function reverseGeocodePlaceName(coords: Coordinates): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) return null;
    const locality = place.city ?? place.subregion ?? place.district ?? null;
    const region = place.region ?? null;
    if (locality && region && locality !== region) return `${locality}, ${region}`;
    return locality ?? region ?? place.country ?? null;
  } catch {
    return null;
  }
}
