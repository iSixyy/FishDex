import axios, { AxiosError, AxiosInstance } from "axios";

import { API_URL } from "@/constants/config";
import { getToken } from "@/services/storageService";

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Callback registrable para reaccionar a un 401 (token caducado/inválido)
 * sin que este módulo dependa de AuthContext: api.ts se importa desde muchos
 * servicios y AuthContext importa servicios, así que importar AuthContext
 * aquí crearía un ciclo de imports. En su lugar, AuthContext se registra a
 * sí mismo como handler en un useEffect. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // El propio login rechaza con 401 cuando el email o la contraseña son
      // incorrectos: eso no es una sesión caducada, es un error de
      // credenciales que la pantalla de login debe mostrar tal cual.
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: unknown }>;
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    if (axiosError.code === "ECONNABORTED" || !axiosError.response) {
      return "No se ha podido conectar con el servidor. Comprueba tu conexión o vuelve a intentarlo.";
    }
    return "Ha ocurrido un error inesperado.";
  }
  return "Ha ocurrido un error inesperado.";
}

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}
