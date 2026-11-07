import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { DexText } from "@/components/DexFrame";
import { DexScreen } from "@/components/DexScreen";
import { FishDexCard } from "@/components/FishDexCard";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { STORAGE_KEYS } from "@/constants/config";
import { BORDER, fonts, radius, spacing, ThemeColors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { getMyCaptures } from "@/services/captureService";
import { getFishDex } from "@/services/fishService";
import { getCache, setCache } from "@/services/storageService";
import { FishDexProgress, FishSpeciesSummary } from "@/types";

type Filter = "todas" | "capturadas" | "recientes" | "favoritas";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "TODAS" },
  { value: "capturadas", label: "CAPT." },
  { value: "recientes", label: "RECIENT." },
  { value: "favoritas", label: "FAVS" },
];

const VIEW_MODE_KEY = "fishdex.dex_view_mode";

/** La FishDex con aspecto de Pokédex marina: carcasa, lente, LEDs y
 * pantalla LCD con tipografía pixelada. Toda la lista vive "dentro" de la
 * pantalla del dispositivo, en cuadrícula o en lista numerada. */
export default function FishDexScreen() {
  const { refreshUser } = useAuth();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [dex, setDex] = useState<FishDexProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Orden de especies descubiertas por captura más reciente. `null` = no
  // disponible (falló getMyCaptures): "Recientes" cae a mostrar "Todas".
  const [recentOrder, setRecentOrder] = useState<number[] | null>(null);
  const [favourites, setFavourites] = useState<Set<number>>(new Set());

  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );
  // Solo la última carga lanzada puede aplicar su resultado.
  const requestIdRef = useRef(0);

  useEffect(() => {
    getCache<number[]>(STORAGE_KEYS.FAVOURITES).then((stored) => {
      if (isMountedRef.current && stored) setFavourites(new Set(stored));
    });
    getCache<"grid" | "list">(VIEW_MODE_KEY).then((stored) => {
      if (isMountedRef.current && stored) setViewMode(stored);
    });
  }, []);

  const load = useCallback(async () => {
    const myId = ++requestIdRef.current;
    try {
      const data = await getFishDex();
      if (myId !== requestIdRef.current || !isMountedRef.current) return;
      setDex(data);
      setError(false);
      try {
        const captures = await getMyCaptures();
        if (myId !== requestIdRef.current || !isMountedRef.current) return;
        const seen = new Set<number>();
        const order: number[] = [];
        [...captures]
          .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
          .forEach((capture) => {
            if (!seen.has(capture.fish_species_id)) {
              seen.add(capture.fish_species_id);
              order.push(capture.fish_species_id);
            }
          });
        setRecentOrder(order);
      } catch {
        if (myId === requestIdRef.current && isMountedRef.current) setRecentOrder(null);
      }
    } catch {
      if (myId === requestIdRef.current && isMountedRef.current) setError(true);
    } finally {
      if (myId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshUser();
    }, [load, refreshUser])
  );

  const toggleFavourite = useCallback((speciesId: number) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(speciesId)) next.delete(speciesId);
      else next.add(speciesId);
      setCache(STORAGE_KEYS.FAVOURITES, Array.from(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleViewMode = () => {
    const next = viewMode === "grid" ? "list" : "grid";
    setViewMode(next);
    setCache(VIEW_MODE_KEY, next).catch(() => {});
  };

  const visibleSpecies = useMemo<FishSpeciesSummary[]>(() => {
    if (!dex) return [];
    let list = dex.species;
    if (filter === "capturadas") list = list.filter((s) => s.unlocked);
    if (filter === "favoritas") list = list.filter((s) => favourites.has(s.id));
    if (filter === "recientes" && recentOrder !== null) {
      const byId = new Map(dex.species.map((s) => [s.id, s] as const));
      list = recentOrder.map((id) => byId.get(id)).filter((s): s is FishSpeciesSummary => !!s);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      // Se busca por número de Dex o por nombre (solo en las descubiertas:
      // buscar no debe revelar el nombre de una especie bloqueada).
      list = list.filter(
        (s) => String(s.dex_number).padStart(3, "0").includes(q) || (s.unlocked && s.name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [dex, filter, recentOrder, favourites, query]);

  if (loading) return <DexScreen title="FishDex"><LoadingScreen message="Encendiendo la FishDex..." /></DexScreen>;

  const counter = dex ? `${String(dex.discovered).padStart(3, "0")}/${String(dex.total).padStart(3, "0")}` : undefined;

  return (
    <DexScreen title="FishDex" counter={counter ? `${counter} descubiertas` : undefined} screenStyle={styles.screen}>
        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <Icon name="search" size={14} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nº o nombre..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
            />
          </View>
          <Pressable onPress={toggleViewMode} style={styles.modeButton} accessibilityLabel="Cambiar vista" hitSlop={6}>
            <Icon name={viewMode === "grid" ? "list" : "grid"} size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.value} onPress={() => setFilter(f.value)} style={[styles.filter, filter === f.value && styles.filterActive]}>
              <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          key={viewMode}
          data={visibleSpecies}
          keyExtractor={(item) => String(item.dex_number)}
          numColumns={viewMode === "grid" ? 3 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.row : undefined}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.textPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <DexText size="small">{error && !dex ? "SIN SEÑAL" : "SIN RESULTADOS"}</DexText>
              <DexText muted style={styles.emptyText}>
                {error && !dex
                  ? "No se ha podido cargar la FishDex. Desliza para reintentar."
                  : filter === "favoritas"
                    ? "Mantén pulsada una especie descubierta para añadirla."
                    : filter === "recientes" || filter === "capturadas"
                      ? "Registra una captura para verla aquí."
                      : "Prueba con otro número o nombre."}
              </DexText>
            </View>
          }
          renderItem={({ item }) => (
            <FishDexCard
              species={item}
              variant={viewMode === "grid" ? "grid" : "row"}
              favourite={favourites.has(item.id)}
              onPress={() => router.push(`/fishdex/${item.id}`)}
              onLongPress={item.unlocked ? () => toggleFavourite(item.id) : undefined}
            />
          )}
        />
      <Text style={styles.hint}>Mantén pulsada una especie para marcarla como favorita</Text>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { padding: spacing.sm },
    controls: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: c.surface,
    },
    searchInput: { flex: 1, fontFamily: fonts.pixelBody, fontSize: 20, color: c.textPrimary, paddingVertical: 4 },
    modeButton: {
      width: 38,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    filters: { flexDirection: "row", gap: 4, marginBottom: spacing.sm },
    filter: {
      flex: 1,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingVertical: 7,
      alignItems: "center",
      backgroundColor: c.surface,
    },
    filterActive: { backgroundColor: c.primary },
    filterText: { fontFamily: fonts.pixel, fontSize: 7, color: c.textPrimary },
    filterTextActive: { color: c.onPrimary },
    list: { paddingBottom: spacing.md, flexGrow: 1 },
    row: { gap: 6, marginBottom: 6 },
    empty: { alignItems: "center", padding: spacing.lg, gap: spacing.sm },
    emptyText: { textAlign: "center" },
    hint: { fontFamily: fonts.pixelBody, fontSize: 16, color: c.textMuted, textAlign: "center", paddingTop: 4 },
  });
