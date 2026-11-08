import { api } from "@/services/api";
import { RegulationCheck, WeatherInfo } from "@/types";

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
