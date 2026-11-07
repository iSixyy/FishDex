import { router, Stack } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ProgressBar } from "@/components/ProgressBar";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { StatTile } from "@/components/StatTile";
import { ThemeColors, fonts, radius, spacing, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { useGameConfig } from "@/context/GameConfigContext";
import { extractErrorMessage } from "@/services/api";
import { getMyCaptures } from "@/services/captureService";
import { getFishDex } from "@/services/fishService";
import { CapturePublic, FishDexProgress, Rarity } from "@/types";

type Period = "7D" | "30D" | "1A" | "TOTAL";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "1A", label: "1A" },
  { value: "TOTAL", label: "Total" },
];

const PERIOD_DAYS: Record<Exclude<Period, "TOTAL">, number> = { "7D": 7, "30D": 30, "1A": 365 };

/** Mismo criterio de "rara+" que el resto de la app: todo lo que no es
 * COMÚN ni POCO COMÚN. */
const RARE_PLUS = new Set<Rarity>(["RARE", "EPIC", "LEGENDARY", "MYTHIC"]);

const MONTH_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const CHART_MONTHS = 7;

const FALLBACK_RARITY_ORDER: Rarity[] = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];

interface PeriodSummary {
  captures: number;
  species: number;
  rare: number;
  legendary: number;
}

function summarize(list: CapturePublic[]): PeriodSummary {
  const species = new Set<number>();
  const rare = new Set<number>();
  const legendary = new Set<number>();
  list.forEach((c) => {
    species.add(c.fish_species_id);
    if (RARE_PLUS.has(c.rarity)) rare.add(c.fish_species_id);
    if (c.rarity === "LEGENDARY") legendary.add(c.fish_species_id);
  });
  return { captures: list.length, species: species.size, rare: rare.size, legendary: legendary.size };
}

/** "+3" / "-2". Cuando no hay variación no se muestra nada: un "+0" con
 * flecha hacia arriba sería confuso (el componente siempre pinta flecha). */
function formatDelta(current: number, previous: number): string | null {
  const diff = current - previous;
  if (diff === 0) return null;
  return diff > 0 ? `+${diff}` : `${diff}`;
}

interface MonthBucket {
  key: string;
  label: string;
  count: number;
}

function buildMonthBuckets(captures: CapturePublic[]): MonthBucket[] {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_ABBR[d.getMonth()], count: 0 });
  }
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  captures.forEach((c) => {
    const d = new Date(c.captured_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = indexByKey.get(key);
    if (idx != null) buckets[idx].count += 1;
  });
  return buckets;
}

export default function StatsScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { config, rarityColor, rarityLabel } = useGameConfig();

  const [period, setPeriod] = useState<Period>("TOTAL");
  const [captures, setCaptures] = useState<CapturePublic[] | null>(null);
  const [fishDex, setFishDex] = useState<FishDexProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getMyCaptures(), getFishDex()])
      .then(([capturesData, dex]) => {
        if (cancelled) return;
        setCaptures(capturesData);
        setFishDex(dex);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!captures) return null;
    if (period === "TOTAL") {
      return { current: summarize(captures), previous: null as PeriodSummary | null };
    }
    const days = PERIOD_DAYS[period];
    const nowTs = Date.now();
    const currentStart = nowTs - days * 86_400_000;
    const previousStart = nowTs - 2 * days * 86_400_000;
    const currentList = captures.filter((c) => {
      const t = new Date(c.captured_at).getTime();
      return t >= currentStart && t <= nowTs;
    });
    const previousList = captures.filter((c) => {
      const t = new Date(c.captured_at).getTime();
      return t >= previousStart && t < currentStart;
    });
    return { current: summarize(currentList), previous: summarize(previousList) };
  }, [captures, period]);

  const monthBuckets = useMemo(() => buildMonthBuckets(captures ?? []), [captures]);
  const maxBucketCount = Math.max(0, ...monthBuckets.map((b) => b.count));

  const rarityKeys: Rarity[] = (config?.rarities.map((r) => r.key) as Rarity[] | undefined) ?? FALLBACK_RARITY_ORDER;
  const unlockedByRarity = useMemo(() => {
    const map = new Map<string, number>();
    fishDex?.species.forEach((s) => {
      if (s.unlocked && s.rarity) {
        map.set(s.rarity, (map.get(s.rarity) ?? 0) + 1);
      }
    });
    return map;
  }, [fishDex]);
  const totalUnlocked = fishDex?.discovered ?? 0;

  return (
    <DexScreen title="Estadísticas" counter="Tu diario de pesca" onBack={() => router.back()}>
      <View style={styles.tabsRow}>
        <SegmentedTabs options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </View>

      {loading ? (
        <LoadingScreen message="Cargando estadísticas..." />
      ) : error || !captures || !fishDex || !metrics ? (
        <EmptyState
          icon="alert"
          title="No se han podido cargar las estadísticas"
          description={error ?? undefined}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.gridRow}>
            <StatTile
              icon="hook"
              label="Capturas"
              value={String(metrics.current.captures)}
              delta={metrics.previous ? formatDelta(metrics.current.captures, metrics.previous.captures) : null}
            />
            <StatTile
              icon="eye"
              label="Especies"
              value={String(metrics.current.species)}
              delta={metrics.previous ? formatDelta(metrics.current.species, metrics.previous.species) : null}
            />
          </View>
          <View style={styles.gridRow}>
            <StatTile
              icon="gem"
              label="Raras"
              value={String(metrics.current.rare)}
              delta={metrics.previous ? formatDelta(metrics.current.rare, metrics.previous.rare) : null}
            />
            <StatTile
              icon="trophy"
              label="Legendarias"
              value={String(metrics.current.legendary)}
              delta={metrics.previous ? formatDelta(metrics.current.legendary, metrics.previous.legendary) : null}
            />
          </View>

          <Text style={styles.sectionTitle}>Actividad de capturas</Text>
          {captures.length === 0 ? (
            <EmptyState
              icon="chart"
              title="Aún no hay capturas"
              description="Registra tu primera captura para ver tu actividad."
            />
          ) : (
            <Card style={styles.chartCard}>
              <View style={styles.chartRow}>
                {monthBuckets.map((b) => {
                  const heightPct = maxBucketCount > 0 ? (b.count / maxBucketCount) * 100 : 0;
                  const isMax = maxBucketCount > 0 && b.count === maxBucketCount;
                  return (
                    <View key={b.key} style={styles.chartCol}>
                      <View style={styles.chartTrack}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: `${b.count > 0 ? Math.max(heightPct, 6) : 0}%`,
                              backgroundColor: isMax ? colors.primary : colors.accent,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartLabel}>{b.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          )}

          <Text style={styles.sectionTitle}>Especies por rareza</Text>
          <Card style={styles.rarityCard}>
            {rarityKeys.map((key) => {
              const count = unlockedByRarity.get(key) ?? 0;
              // No existe un "total por rareza" fiable en cliente: la
              // FishDex oculta la rareza de las especies no descubiertas.
              // La barra muestra qué proporción de TUS especies descubiertas
              // es de esta rareza, no el progreso frente al total del juego.
              const progress = totalUnlocked > 0 ? count / totalUnlocked : 0;
              const color = rarityColor(key);
              return (
                <View key={key} style={styles.rarityRow}>
                  <View style={[styles.rarityDot, { backgroundColor: color }]} />
                  <Text style={styles.rarityName}>{rarityLabel(key)}</Text>
                  <View style={styles.rarityBarWrap}>
                    <ProgressBar progress={progress} color={color} />
                  </View>
                  <Text style={styles.rarityCount}>{count}</Text>
                </View>
              );
            })}
          </Card>
        </ScrollView>
      )}
    </DexScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.title, color: colors.textPrimary, flex: 1, textAlign: "center" },
  tabsRow: { padding: spacing.sm, paddingBottom: 0 },
  content: { padding: spacing.sm, paddingBottom: spacing.xl },
  gridRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { ...typography.overline, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  chartCard: { paddingVertical: spacing.md },
  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  chartCol: { flex: 1, alignItems: "center" },
  chartTrack: {
    width: 18,
    height: 110,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartBar: { width: "100%" },
  chartLabel: { ...typography.captionSmall, color: colors.textSecondary, marginTop: spacing.xs },
  rarityCard: { gap: spacing.sm },
  rarityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rarityDot: { width: 10, height: 10, borderWidth: 1.5, borderColor: colors.border },
  rarityName: { ...typography.body, color: colors.textPrimary, width: 92 },
  rarityBarWrap: { flex: 1 },
  rarityCount: { fontFamily: fonts.pixel, fontSize: 10, color: colors.textPrimary, width: 28, textAlign: "right" },
});
