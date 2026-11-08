import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { LongPressEvent, Marker, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { DexScreen } from "@/components/DexScreen";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { TextField } from "@/components/TextField";
import { radius, shadow, spacing, TAB_BAR_HEIGHT, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import { getHeatmap, getMapCaptures } from "@/services/captureService";
import { getSpeciesCatalog } from "@/services/fishService";
import { getCurrentCoordinates } from "@/services/locationService";
import { createSpot, getSpots } from "@/services/spotService";
import { formatDateTime, formatLength, formatWeight } from "@/utils/format";
import { FishCatalogEntry, HeatmapResponse, MapCapturePin, Spot } from "@/types";
import { Alert } from "@/utils/alert";

// Encuadre de la península entera: con 9° de ancho, en un móvil en vertical
// quedaban fuera Galicia y Cataluña (de -9,3° a 3,3° de longitud).
const SPAIN_INITIAL_REGION = { latitude: 40.0, longitude: -3.0, latitudeDelta: 9, longitudeDelta: 13.5 };

const MAP_TABS = [
  { value: "captures", label: "Capturas" },
  { value: "spots", label: "Spots" },
  { value: "zones", label: "Zonas" },
] as const;

/** Color de una zona del mapa de calor según su peso relativo (0..1). */
function heatColor(ratio: number): string {
  const alpha = 0.25 + 0.5 * ratio;
  return ratio > 0.66 ? `rgba(192,57,43,${alpha})` : ratio > 0.33 ? `rgba(228,87,46,${alpha})` : `rgba(240,160,40,${alpha})`;
}
type MapTabValue = (typeof MAP_TABS)[number]["value"];

/** Agrupa capturas que comparten (casi) la misma coordenada (~11 m) para
 * no pintar pines superpuestos. */
interface PinCluster {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  representative: MapCapturePin;
}

function clusterPins(pins: MapCapturePin[]): PinCluster[] {
  const buckets = new Map<string, MapCapturePin[]>();
  for (const pin of pins) {
    const key = `${pin.latitude.toFixed(4)},${pin.longitude.toFixed(4)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(pin);
    else buckets.set(key, [pin]);
  }
  return Array.from(buckets.entries()).map(([key, group]) => ({
    key,
    latitude: group.reduce((sum, p) => sum + p.latitude, 0) / group.length,
    longitude: group.reduce((sum, p) => sum + p.longitude, 0) / group.length,
    count: group.length,
    representative: [...group].sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1))[0],
  }));
}

export default function MapScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [tab, setTab] = useState<MapTabValue>("captures");
  const [pins, setPins] = useState<MapCapturePin[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapCapturePin | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [showTileOverlay, setShowTileOverlay] = useState(true);
  const [centering, setCentering] = useState(false);

  const [newSpotCoords, setNewSpotCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [spotName, setSpotName] = useState("");
  const [spotNotes, setSpotNotes] = useState("");
  const [savingSpot, setSavingSpot] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([getMapCaptures(), getSpots()])
        .then(([capturePins, spotList]) => {
          if (cancelled) return;
          setPins(capturePins);
          setSpots(spotList);
          setLoadError(null);
        })
        .catch((err) => {
          // Antes un fallo se mostraba como "no tienes capturas": ahora se dice.
          if (!cancelled) setLoadError(extractErrorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const clusters = useMemo(() => clusterPins(pins), [pins]);

  // --- Zonas (mapa de calor de la comunidad) ---
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [heatSpecies, setHeatSpecies] = useState<FishCatalogEntry | null>(null);
  const [catalog, setCatalog] = useState<FishCatalogEntry[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  useEffect(() => {
    if (tab !== "zones") return;
    let cancelled = false;
    getHeatmap(heatSpecies?.id ?? null)
      .then((data) => !cancelled && setHeatmap(data))
      .catch((err) => !cancelled && setLoadError(extractErrorMessage(err)));
    if (catalog.length === 0) getSpeciesCatalog().then(setCatalog).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tab, heatSpecies]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxCaptures = Math.max(1, ...(heatmap?.cells.map((c) => c.captures) ?? [1]));

  const handleCenterOnMe = async () => {
    setCentering(true);
    const coords = await getCurrentCoordinates();
    setCentering(false);
    if (!coords) {
      Alert.alert("Ubicación no disponible", "No se ha podido obtener tu posición GPS.");
      return;
    }
    mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 500);
  };

  const handleLongPress = (event: LongPressEvent) => {
    setSpotName("");
    setSpotNotes("");
    setNewSpotCoords(event.nativeEvent.coordinate);
  };

  const handleSaveSpot = async () => {
    if (!newSpotCoords || !spotName.trim()) return;
    setSavingSpot(true);
    try {
      const spot = await createSpot({ name: spotName.trim(), notes: spotNotes.trim() || null, ...newSpotCoords });
      setSpots((prev) => [spot, ...prev]);
      setNewSpotCoords(null);
      setTab("spots");
      router.push(`/spots/${spot.id}`);
    } catch (err) {
      Alert.alert("No se ha podido guardar el spot", extractErrorMessage(err));
    } finally {
      setSavingSpot(false);
    }
  };

  const cardBottomOffset = spacing.sm;

  return (
    <DexScreen title="Mapa" counter="Mantén pulsado: nuevo spot" screenStyle={styles.screen}>
      <View style={styles.tabsRow}>
        <SegmentedTabs
          options={MAP_TABS}
          value={tab}
          onChange={(value) => {
            setTab(value);
            setSelected(null);
            setSelectedSpot(null);
          }}
        />
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === "android" ? PROVIDER_DEFAULT : undefined}
          initialRegion={SPAIN_INITIAL_REGION}
          onPress={() => {
            setSelected(null);
            setSelectedSpot(null);
          }}
          onLongPress={handleLongPress}
        >
          {showTileOverlay ? (
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
          ) : null}
          {tab === "zones"
            ? (heatmap?.cells ?? []).map((cell) => {
                // Burbuja en píxeles (no un círculo en metros): una zona de
                // ~11 km se vería como un punto a escala de España.
                const ratio = cell.captures / maxCaptures;
                const size = 26 + Math.round(26 * ratio);
                return (
                  <Marker key={`${cell.latitude},${cell.longitude}`} coordinate={{ latitude: cell.latitude, longitude: cell.longitude }}>
                    <View style={[styles.heatBubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: heatColor(ratio) }]}>
                      <Text style={styles.heatBubbleText}>{cell.captures}</Text>
                    </View>
                  </Marker>
                );
              })
            : tab === "captures"
            ? clusters.map((cluster) => (
                <Marker
                  key={cluster.key}
                  coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                  onPress={() => setSelected(cluster.representative)}
                >
                  {cluster.count > 1 ? (
                    <View style={styles.clusterPin}>
                      <Text style={styles.clusterPinText}>{cluster.count}</Text>
                    </View>
                  ) : (
                    <View style={styles.singlePin} />
                  )}
                </Marker>
              ))
            : spots.map((spot) => (
                <Marker key={spot.id} coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} onPress={() => setSelectedSpot(spot)}>
                  <View style={[styles.spotPin, !spot.is_mine && styles.spotPinShared]}>
                    <Icon name="pin" size={16} color={spot.is_mine ? colors.onPrimary : "#FFFFFF"} filled />
                  </View>
                </Marker>
              ))}
        </MapView>

        {loading ? (
          <View style={styles.banner}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.bannerText}>Cargando...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.banner}>
            <Icon name="offline" size={16} color={colors.danger} />
            <Text style={styles.bannerText}>{loadError}</Text>
          </View>
        ) : tab === "zones" ? (
          <View style={styles.zonesPanel}>
            <Pressable style={styles.zonesSelect} onPress={() => setPickerVisible(true)}>
              <Icon name="fish" size={16} color={colors.textSecondary} />
              <Text style={styles.zonesSelectText} numberOfLines={1}>
                {heatSpecies ? heatSpecies.name : "Todas las especies"}
              </Text>
              {heatSpecies ? (
                <Pressable onPress={() => setHeatSpecies(null)} hitSlop={8}>
                  <Icon name="close" size={16} color={colors.textMuted} />
                </Pressable>
              ) : (
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              )}
            </Pressable>
            <Text style={styles.bannerText}>
              {heatmap && heatmap.cells.length === 0
                ? "Aún no hay zonas con suficientes pescadores para mostrarlas."
                : `${heatmap?.cells.length ?? 0} zonas del último año. Solo se muestran zonas de ~11 km con ${heatmap?.min_anglers ?? 2}+ pescadores: nunca el sitio exacto de nadie.`}
            </Text>
          </View>
        ) : (tab === "captures" ? pins.length : spots.length) === 0 ? (
          <View style={styles.banner}>
            <Icon name="info" size={16} color={colors.textSecondary} />
            <Text style={styles.bannerText}>
              {tab === "captures"
                ? "Registra una captura con GPS para verla aquí."
                : "Aún no tienes spots: mantén pulsado el mapa para crear uno."}
            </Text>
          </View>
        ) : null}

        <View style={styles.floatingButtons}>
          <Pressable accessibilityLabel="Capas del mapa" onPress={() => setShowTileOverlay((v) => !v)} style={styles.floatingButton}>
            <Icon name="layers" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable accessibilityLabel="Centrar en mi ubicación" onPress={handleCenterOnMe} disabled={centering} style={styles.floatingButton}>
            {centering ? <ActivityIndicator size="small" color={colors.textPrimary} /> : <Icon name="locate" size={20} color={colors.textPrimary} />}
          </Pressable>
        </View>

        {selected ? (
          <View style={[styles.calloutWrap, { bottom: cardBottomOffset }]}>
            <Card onPress={() => router.push(`/capture/${selected.id}`)} style={styles.calloutRow}>
              {selected.thumbnail_url ? (
                <Image source={{ uri: mediaUrl(selected.thumbnail_url) }} style={styles.calloutImage} />
              ) : (
                <View style={[styles.calloutImage, styles.calloutImagePlaceholder]}>
                  <Icon name="fish" size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {selected.fish_species_name}
                </Text>
                <Text style={styles.calloutText}>
                  {formatWeight(selected.weight_kg)} · {formatLength(selected.length_cm)}
                </Text>
                <Text style={styles.calloutText} numberOfLines={1}>
                  {formatDateTime(selected.captured_at)}
                  {selected.location_name ? ` · ${selected.location_name}` : ""}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Card>
          </View>
        ) : null}

        {selectedSpot ? (
          <View style={[styles.calloutWrap, { bottom: cardBottomOffset }]}>
            <Card onPress={() => router.push(`/spots/${selectedSpot.id}`)} style={styles.calloutRow}>
              <View style={[styles.calloutImage, styles.calloutImagePlaceholder]}>
                {selectedSpot.photos[0] ? (
                  <Image source={{ uri: mediaUrl(selectedSpot.photos[0].thumbnail_url) }} style={styles.calloutImage} />
                ) : (
                  <Icon name="pin" size={22} color={colors.textMuted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {selectedSpot.name}
                </Text>
                <Text style={styles.calloutText} numberOfLines={1}>
                  {selectedSpot.is_mine
                    ? selectedSpot.shared_with.length > 0
                      ? `Compartido con ${selectedSpot.shared_with.length} amigo(s)`
                      : "Privado"
                    : `Compartido por ${selectedSpot.owner.display_name}`}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Card>
          </View>
        ) : null}

        <Text style={[styles.attribution, { bottom: 2 }]}>© OpenStreetMap contributors</Text>
      </View>

      <SpeciesPicker
        visible={pickerVisible}
        species={catalog}
        onSelect={(s) => {
          setHeatSpecies(s);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />

      <Modal visible={!!newSpotCoords} transparent animationType="fade" onRequestClose={() => !savingSpot && setNewSpotCoords(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>nuevo spot.</Text>
            <Text style={styles.modalSub}>Es privado: solo tú lo verás, salvo que lo compartas con amigos concretos.</Text>
            <TextField label="Nombre" value={spotName} onChangeText={setSpotName} placeholder="La roca del faro" maxLength={80} />
            <TextField
              label="Notas (opcional)"
              value={spotNotes}
              onChangeText={setSpotNotes}
              placeholder="Mejor con marea subiendo..."
              multiline
              maxLength={2000}
            />
            <PrimaryButton label="Guardar spot" onPress={handleSaveSpot} loading={savingSpot} disabled={!spotName.trim()} />
            <Pressable onPress={() => !savingSpot && setNewSpotCoords(null)} style={styles.cancelLink}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    screen: { padding: 0 },
    tabsRow: { padding: spacing.sm, borderBottomWidth: 2, borderBottomColor: c.border },
    mapWrapper: { flex: 1, overflow: "hidden" },
    banner: {
      position: "absolute",
      top: spacing.md,
      left: spacing.md,
      right: 72,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: spacing.sm + 2,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: c.border,
    },
    bannerText: { ...typography.caption, color: c.textSecondary, flex: 1 },
    zonesPanel: {
      position: "absolute",
      top: spacing.sm,
      left: spacing.sm,
      right: 64,
      gap: spacing.xs,
      padding: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: radius.md,
    },
    zonesSelect: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    heatBubble: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(158,52,23,0.8)" },
    heatBubbleText: { ...typography.pixelSmall, fontSize: 8, color: "#FFFFFF" },
    zonesSelectText: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    floatingButtons: { position: "absolute", right: spacing.md, top: spacing.md, gap: spacing.sm },
    floatingButton: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: c.border,
    },
    singlePin: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, borderWidth: 3, borderColor: c.surface },
    clusterPin: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 6,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.surface,
    },
    clusterPinText: { ...typography.caption, color: c.onPrimary, fontFamily: typography.subtitle.fontFamily },
    spotPin: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.surface,
    },
    spotPinShared: { backgroundColor: c.accent },
    calloutWrap: { position: "absolute", left: spacing.md, right: spacing.md },
    calloutRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    calloutImage: { width: 56, height: 56, borderRadius: radius.sm, overflow: "hidden" },
    calloutImagePlaceholder: { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    calloutTitle: { ...typography.subtitle, color: c.textPrimary },
    calloutText: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
    attribution: { position: "absolute", right: spacing.sm, ...typography.captionSmall, color: "#444", backgroundColor: "rgba(255,255,255,0.7)", paddingHorizontal: 4 },
    modalOverlay: { flex: 1, backgroundColor: c.scrim, justifyContent: "center", padding: spacing.lg },
    modalCard: { backgroundColor: c.background, borderRadius: radius.xl, padding: spacing.lg },
    modalTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    modalSub: { ...typography.caption, color: c.textSecondary, marginTop: 4, marginBottom: spacing.md },
    cancelLink: { alignItems: "center", marginTop: spacing.md },
    cancelText: { ...typography.bodyMedium, color: c.textSecondary },
  });
