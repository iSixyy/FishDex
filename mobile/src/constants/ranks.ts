import { IconName } from "@/components/Icon";

/** Iconografía de los 6 rangos competitivos.
 *
 * El backend envía un emoji en `RankInfo.icon` (🥉🥈🥇👑), que se ignora a
 * propósito: la interfaz usa su propio set SVG para no depender de cómo
 * dibuje cada Android los emojis. Se indexa por `rank.key`, que es estable,
 * y no por el nombre visible, que podría traducirse. */
export const RANK_ICONS: Record<string, IconName> = {
  ALEVIN: "hook",
  PESCADOR: "fish",
  PESCADOR_EXPERTO: "star",
  MAESTRO: "medal",
  CAPITAN: "trophy",
  LEYENDA: "crown",
};

/** Color de acento de cada rango (legible en claro y en oscuro). */
export const RANK_COLORS: Record<string, string> = {
  ALEVIN: "#8B98A5",
  PESCADOR: "#3E7FB8",
  PESCADOR_EXPERTO: "#C0503F",
  MAESTRO: "#4C9A72",
  CAPITAN: "#C9A227",
  LEYENDA: "#7D5BA6",
};

export function rankIconFor(rankKey: string | null | undefined): IconName {
  return (rankKey && RANK_ICONS[rankKey]) || "hook";
}

export function rankColorFor(rankKey: string | null | undefined): string {
  return (rankKey && RANK_COLORS[rankKey]) || "#8B98A5";
}
