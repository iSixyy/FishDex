import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { STORAGE_KEYS } from "@/constants/config";
import * as authService from "@/services/authService";
import { setUnauthorizedHandler } from "@/services/api";
import { unregisterPushNotifications } from "@/services/notificationService";
import { getToken, setCache } from "@/services/storageService";
import { getMyProfile } from "@/services/userService";
import { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: authService.RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /** Vuelve a pedir el usuario al backend (ELO y rango cambian con cada
   * captura). Sin esto, la cabecera de Inicio mostraba para siempre el ELO
   * del momento del login. Nunca lanza: sin red se queda con el actual. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (token) {
        const cachedUser = await authService.getCachedUser();
        if (cachedUser && !cancelled) setUserState(cachedUser);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedUser = await authService.login({ email, password });
    setUserState(loggedUser);
  }, []);

  const register = useCallback(async (payload: authService.RegisterPayload) => {
    const newUser = await authService.register(payload);
    setUserState(newUser);
  }, []);

  const logout = useCallback(async () => {
    // Antes de borrar el token: la baja del dispositivo necesita la sesión.
    await unregisterPushNotifications();
    await authService.logout();
    setUserState(null);
  }, []);

  // Actualiza el estado Y la caché, para que al reabrir la app offline se
  // muestre el último ELO conocido y no el del login.
  const setUser = useCallback((next: User) => {
    setUserState(next);
    setCache(STORAGE_KEYS.AUTH_USER, next).catch(() => undefined);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setUser(profile.user);
    } catch {
      // Sin conexión o sesión caducada (el 401 ya lo gestiona el interceptor).
    }
  }, [setUser]);

  // Cuando el backend rechaza una petición con 401 (token caducado o
  // inválido), el interceptor de api.ts dispara este handler: se limpia la
  // sesión y se manda al usuario a la pantalla de login en vez de dejarlo
  // atrapado en una pantalla de error sin salida.
  //
  // Varias peticiones pueden recibir 401 a la vez: `loggingOut` evita repetir
  // el cierre (y la navegación) una vez por petición. También se da de baja
  // el token push: antes el móvil seguía recibiendo los avisos de la cuenta
  // caducada (el backend permite la baja sin sesión válida).
  const loggingOut = useRef(false);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      unregisterPushNotifications()
        .catch(() => undefined)
        .then(() => authService.logout({ revokeOnServer: false }))
        .finally(() => {
          loggingOut.current = false;
          setUserState(null);
          router.replace("/auth/login");
        });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, setUser, refreshUser }),
    [user, isLoading, login, register, logout, setUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
