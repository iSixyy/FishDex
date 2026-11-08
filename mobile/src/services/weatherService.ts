import { api } from "@/services/api";
import { BiteForecast, RegulationCheck, WeatherInfo } from "@/types";

export async function getWeather(latitude: number, longitude: number): Promise<WeatherInfo> {
  const { data } = await api.get<WeatherInfo>("/weather", { params: { latitude, longitude } });
  return data;
}

/** Avisos de veda / talla mínima / cupo antes de guardar una captura. */
export async function checkRegulation(params: {
  species_id: number;
  length_cm?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Día de la captura, "AAAA-MM-DD". */
  on_date?: string | null;
}): Promise<RegulationCheck> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null));
  const { data } = await api.get<RegulationCheck>("/regulations/check", { params: clean });
  return data;
}

/** Previsión de picada (0-100) en un punto. Nunca falla por el clima: sin
 * datos usa la hora y la luna (`partial`). */
export async function getForecast(latitude: number, longitude: number): Promise<BiteForecast> {
  const { data } = await api.get<BiteForecast>("/forecast", { params: { latitude, longitude } });
  return data;
}

export async function getSpotForecast(spotId: number): Promise<BiteForecast> {
  const { data } = await api.get<BiteForecast>(`/spots/${spotId}/forecast`);
  return data;
}
