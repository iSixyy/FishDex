import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { FALLBACK_RARITY_COLORS } from "@/constants/theme";
import { getGameConfig } from "@/services/configService";
import { GameConfig, Rarity } from "@/types";

interface GameConfigContextValue {
  config: GameConfig | null;
  isLoading: boolean;
  rarityColor: (rarity: Rarity | string) => string;
  rarityLabel: (rarity: Rarity | string) => string;
  rankIcon: (rankName: string) => string;
}

const GameConfigContext = createContext<GameConfigContextValue | undefined>(undefined);

export function GameConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getGameConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<GameConfigContextValue>(() => {
    const rarityColor = (rarity: Rarity | string) =>
      config?.rarities.find((r) => r.key === rarity)?.color ?? FALLBACK_RARITY_COLORS[rarity] ?? "#9CA3AF";
    const rarityLabel = (rarity: Rarity | string) =>
      config?.rarities.find((r) => r.key === rarity)?.label ?? rarity;
    // La UI ya no pinta el emoji que manda el backend en `RankInfo.icon`: usa
    // su propio set SVG (ver `src/constants/ranks.ts`). Esto se conserva solo
    // para consultar el icono declarado por el servidor si hiciera falta.
    const rankIcon = (rankName: string) => config?.ranks.find((r) => r.name === rankName)?.icon ?? "";

    return { config, isLoading, rarityColor, rarityLabel, rankIcon };
  }, [config, isLoading]);

  return <GameConfigContext.Provider value={value}>{children}</GameConfigContext.Provider>;
}

export function useGameConfig(): GameConfigContextValue {
  const context = useContext(GameConfigContext);
  if (!context) throw new Error("useGameConfig debe usarse dentro de GameConfigProvider");
  return context;
}
