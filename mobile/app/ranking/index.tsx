import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { rankColorFor, rankIconFor } from "@/constants/ranks";
import { fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { getSpeciesCatalog } from "@/services/fishService";
import {
  getFriendsRanking,
  getGlobalRanking,
  getRegionRanking,
  getRegions,
  getSpeciesRanking,
  RANKING_PAGE_SIZE,
} from "@/services/rankingService";
import { formatElo, formatWeight } from "@/utils/format";
import { FishCatalogEntry, RankedValueEntry } from "@/types";

type Scope = "friends" | "global" | "region" | "species";

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
  const [scope, setScope] = useState<Scope>("friends");
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
    scope === "species" ? formatWeight(value) : `${formatElo(Math.round(value))} ELO`;
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
        <SegmentedTabs options={SCOPES} value={scope} onChange={setScope} />
        {scope === "region" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {regions.map((r) => (
              <Pressable key={r} onPress={() => setRegion(r)} style={[styles.chip, region === r && styles.chipActive]}>
                <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {scope === "species" ? (
          <Pressable style={styles.speciesSelect} onPress={() => setPickerVisible(true)}>
            <Icon name="fish" size={18} color={colors.textSecondary} />
            <Text style={styles.speciesText}>{species ? species.name : "Elige una especie"}</Text>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Text style={styles.caption}>
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
              description={scope === "friends" ? "Añade amigos para competir." : undefined}
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
  });
