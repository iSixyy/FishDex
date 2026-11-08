import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { rankColorFor, rankIconFor } from "@/constants/ranks";
import { fonts, radius, SEASON_TIER_COLORS, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { getSpeciesCatalog } from "@/services/fishService";
import {
  getCurrentSeason,
  getFriendsRanking,
  getGlobalRanking,
  getRegionRanking,
  getRegions,
  getSpeciesRanking,
  RANKING_PAGE_SIZE,
} from "@/services/rankingService";
import { formatElo, formatWeight } from "@/utils/format";
import { FishCatalogEntry, RankedValueEntry, SeasonPage } from "@/types";

type Scope = "season" | "friends" | "global" | "region" | "species";

// La temporada no va en las pestañas (con 5 no caben los nombres): tiene su
// propio banner encima, que la activa.
const SCOPES: { value: Scope; label: string }[] = [
  { value: "friends", label: "Amigos" },
  { value: "global", label: "Global" },
  { value: "region", label: "Región" },
  { value: "species", label: "Especie" },
];

export default function RankingScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ scope?: string }>();
  const [scope, setScope] = useState<Scope>(params.scope === "season" ? "season" : "friends");
  const [season, setSeason] = useState<SeasonPage | null>(null);
  const [entries, setEntries] = useState<RankedValueEntry[]>([]);
  const [me, setMe] = useState<RankedValueEntry | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<FishCatalogEntry[]>([]);
  const [species, setSpecies] = useState<FishCatalogEntry | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    getCurrentSeason()
      .then(setSeason)
      .catch(() => undefined);
    getRegions()
      .then((list) => {
        setRegions(list);
        setRegion((current) => current ?? list[0] ?? null);
      })
      .catch(() => undefined);
    getSpeciesCatalog()
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (scope === "friends") {
        const data = await getFriendsRanking();
        return {
          entries: data.entries.map((e) => ({ position: e.position, user: e.user, value: e.user.elo })),
          me: null,
        };
      }
      if (scope === "season") {
        const page = await getCurrentSeason(offset);
        setSeason(page);
        return page;
      }
      if (scope === "global") return getGlobalRanking(offset);
      if (scope === "region") return region ? getRegionRanking(region, offset) : { entries: [], me: null };
      return species ? getSpeciesRanking(species.id, offset) : { entries: [], me: null };
    },
    [scope, region, species]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage(0)
      .then((page) => {
        if (cancelled) return;
        setEntries(page.entries);
        setMe(page.me);
        setHasMore(scope !== "friends" && page.entries.length === RANKING_PAGE_SIZE);
      })
      .catch((err) => !cancelled && setError(extractErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchPage, scope]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(entries.length);
      setEntries((prev) => [...prev, ...page.entries]);
      setHasMore(page.entries.length === RANKING_PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatValue = (value: number) =>
    scope === "species"
      ? formatWeight(value)
      : scope === "season"
        ? `${formatElo(Math.round(value))} pts`
        : `${formatElo(Math.round(value))} ELO`;
  const meVisible = me && entries.some((e) => e.user.id === me.user.id);

  const renderRow = (item: RankedValueEntry, highlight = false) => (
    <View style={[styles.row, (highlight || item.user.id === user?.id) && styles.rowMe]}>
      <Text style={[styles.position, item.position <= 3 && { color: colors.gold }]}>{item.position}</Text>
      <Avatar uri={item.user.avatar} name={item.user.display_name} size={34} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.user.display_name}
        </Text>
        <View style={styles.rankRow}>
          <Icon name={rankIconFor(item.user.rank.key)} size={11} color={rankColorFor(item.user.rank.key)} filled />
          <Text style={styles.rankName}>{item.user.rank.name}</Text>
        </View>
      </View>
      <Text style={styles.value}>{formatValue(item.value)}</Text>
    </View>
  );

  return (
    <DexScreen title="Ranking" counter="Clasificación" onBack={() => router.back()}>
    <View style={styles.container}>
      <View style={styles.controls}>
        {scope !== "season" && season ? (
          <Pressable style={styles.seasonBanner} onPress={() => setScope("season")} accessibilityRole="button">
            <Icon name="flame" size={18} color={colors.cta} filled />
            <View style={{ flex: 1 }}>
              <Text style={styles.seasonBannerTitle}>{season.name}</Text>
              <Text style={styles.seasonBannerSub}>Termina en {daysUntil(season.ends_at)} días · todos empiezan de cero</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <SegmentedTabs options={SCOPES} value={scope === "season" ? ("" as Scope) : scope} onChange={setScope} />
        {scope === "region" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {regions.map((r) => (
              <Pressable key={r} onPress={() => setRegion(r)} style={[styles.chip, region === r && styles.chipActive]}>
                <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {scope === "season" && season ? <SeasonHeader season={season} /> : null}
        {scope === "species" ? (
          <Pressable style={styles.speciesSelect} onPress={() => setPickerVisible(true)}>
            <Icon name="fish" size={18} color={colors.textSecondary} />
            <Text style={styles.speciesText}>{species ? species.name : "Elige una especie"}</Text>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Text style={styles.caption}>
          {scope === "season" && "Puntos = ELO de lo que pescas este trimestre. Cada 3 meses, todos a cero."}
          {scope === "friends" && "Tú y tus amigos, por ELO."}
          {scope === "global" && "Todos los pescadores de FishDex, por ELO."}
          {scope === "region" && "ELO conseguido con capturas en esa comunidad autónoma."}
          {scope === "species" && "Récord de peso de cada pescador en esa especie."}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.textPrimary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <EmptyState icon="alert" title="No se ha podido cargar el ranking" description={error} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => `${item.position}-${item.user.id}`}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              icon="trophy"
              title={scope === "species" && !species ? "Elige una especie" : "Aún no hay nadie aquí"}
              description={
                scope === "friends"
                  ? "Añade amigos para competir."
                  : scope === "season"
                    ? "Registra una captura y estrena la temporada."
                    : undefined
              }
            />
          }
          renderItem={({ item }) => renderRow(item)}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.textPrimary} style={{ margin: spacing.md }} /> : null}
        />
      )}

      {me && !meVisible && !loading ? <View style={styles.meBar}>{renderRow(me, true)}</View> : null}

      <SpeciesPicker
        visible={pickerVisible}
        species={catalog}
        onSelect={(s) => {
          setSpecies(s);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
    </DexScreen>
  );
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Cabecera de la temporada: nombre, cuenta atrás y qué insignia da cada puesto. */
function SeasonHeader({ season }: { season: SeasonPage }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const days = daysUntil(season.ends_at);
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.seasonTop}>
        <Icon name="flame" size={22} color={colors.cta} filled />
        <View style={{ flex: 1 }}>
          <Text style={styles.seasonName}>{season.name}</Text>
          <Text style={styles.seasonEnds}>{days === 0 ? "Termina hoy" : `Termina en ${days} días`}</Text>
        </View>
      </View>
      <View style={styles.rewards}>
        {season.rewards.map((reward) => (
          <View key={reward.tier} style={styles.reward}>
            <Icon name={reward.tier === "PARTICIPANT" ? "medal" : "trophy"} size={16} color={SEASON_TIER_COLORS[reward.tier]} filled />
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardLabel}>{reward.label}</Text>
              <Text style={styles.rewardPositions}>{reward.positions}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    controls: { padding: spacing.md, gap: spacing.sm },
    chips: { gap: spacing.xs },
    chip: { borderRadius: radius.sm, borderWidth: 2, borderColor: c.border, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: c.surface },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { ...typography.caption, color: c.textSecondary },
    chipTextActive: { color: c.onPrimary },
    speciesSelect: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    speciesText: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    caption: { ...typography.caption, color: c.textMuted },
    list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    rowMe: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.border },
    position: { fontFamily: fonts.pixel, fontSize: 10, color: c.textMuted, width: 34, textAlign: "center" },
    name: { ...typography.bodyMedium, color: c.textPrimary },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    rankName: { ...typography.captionSmall, color: c.textMuted },
    value: { ...typography.subtitle, fontSize: 15, color: c.textPrimary },
    meBar: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.lg },
    seasonTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    seasonBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.cta,
      borderRadius: radius.md,
    },
    seasonBannerTitle: { ...typography.pixelSmall, fontSize: 8, color: c.textPrimary },
    seasonBannerSub: { ...typography.captionSmall, color: c.cta },
    seasonName: { ...typography.sectionTitle, color: c.textPrimary },
    seasonEnds: { ...typography.caption, color: c.cta },
    rewards: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.xs },
    reward: { width: "50%", flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingRight: spacing.xs },
    rewardLabel: { ...typography.captionSmall, color: c.textPrimary },
    rewardPositions: { ...typography.captionSmall, fontSize: 13, color: c.textMuted },
  });
