import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors, ThemeColors } from "@/constants/theme";

/** Preferencia del usuario: seguir al sistema o forzar claro/oscuro. */
export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "fishdex.theme_preference";

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark" || stored === "system") setPreferenceState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const isDark = preference === "dark" || (preference === "system" && systemScheme === "dark");

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}

/** Estilos dependientes del tema: `const styles = useStyles(makeStyles)`,
 * con `makeStyles = (c: ThemeColors) => StyleSheet.create({...})` definido
 * FUERA del componente para que el memo solo se recalcule al cambiar el tema. */
export function useStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
