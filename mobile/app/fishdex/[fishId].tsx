import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { DexText } from "@/components/DexFrame";
import { DexScreen } from "@/components/DexScreen";
import { EmptyState } from "@/components/EmptyState";
import { Icon, IconName } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { dex, fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useGameConfig } from "@/context/GameConfigContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import { getMyCaptures } from "@/services/captureService";
import { getSpeciesDetail } from "@/services/fishService";
import { getSpeciesRanking } from "@/services/rankingService";
import { formatDate, formatLength, formatTime, formatWeight } from "@/utils/format";
import { CapturePublic, FishSpeciesDetail, RankingPage } from "@/types";

type TabKey = "info" | "capturas" | "mapa" | "records";

const TABS: { value: TabKey; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "capturas", label: "Capturas" },
  { value: "mapa", label: "Mapa" },
  { value: "records", label: "Récords" },
];

const WATER_LABEL: Record<string, string> = { FRESH: "AGUA DULCE", SALT: "AGUA SALADA", BRACKISH: "SALOBRE" };

function range(min: string, max: string): string {
  return `${min} – ${max}`;
}

export default function FishDetailScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { rarityColor, rarityLabel } = useGameConfig();
  const { fishId } = useLocalSearchParams<{ fishId: string }>();
  const insets = useSafeAreaInsets();

  const [species, setSpecies] = useState<FishSpeciesDetail | null>(null);
  const [captures, setCaptures] = useState<CapturePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  useEffect(() => {
    let cancelled = false;
    const speciesId = Number(fishId);
    if (!speciesId) {
      // Sin este corte el spinner se quedaba girando para siempre.
      setError("Especie no válida.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getSpeciesDetail(speciesId), getMyCaptures(speciesId).catch(() => [] as CapturePublic[])])
      .then(([speciesData, capturesData]) => {
        if (cancelled) return;
        setSpecies(speciesData);
        setCaptures(capturesData);
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
  }, [fishId]);

  // El "sprite" de la entrada es tu mejor captura (la más pesada).
  const bestCapture = useMemo(
    () => (captures.length > 0 ? [...captures].sort((a, b) => b.weight_kg - a.weight_kg)[0] : null),
    [captures]
  );

  if (loading) return <DexScreen title="FishDex" onBack={() => router.back()}><LoadingScreen message="Leyendo la entrada..." /></DexScreen>;
  if (error) return <DexScreen title="FishDex" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar la ficha" description={error} /></DexScreen>;
  if (!species) return <DexScreen title="FishDex" onBack={() => router.back()}><EmptyState icon="help" title="Especie no encontrada" /></DexScreen>;

  const photo = mediaUrl(bestCapture?.image_url ?? bestCapture?.thumbnail_url ?? undefined);
  const accent = rarityColor(species.rarity);
  const number = `No.${String(species.dex_number).padStart(3, "0")}`;

  return (
    <DexScreen
      title={number}
      counter={`${rarityLabel(species.rarity)} · ${captures.length} capturas`}
      onBack={() => router.back()}
    >
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={styles.entry}>
        <View style={styles.entryTop}>
          <View style={[styles.sprite, { borderColor: accent }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.spriteImage} resizeMode="cover" />
            ) : (
              <Icon name="fish" size={52} color={colors.textPrimary} strokeWidth={1.4} />
            )}
          </View>
          <View style={styles.entryInfo}>
            <DexText size="title" numberOfLines={2}>
              {species.name.toUpperCase()}
            </DexText>
            <DexText muted numberOfLines={1}>
              {species.scientific_name}
            </DexText>
            <View style={styles.types}>
              <View style={[styles.type, { backgroundColor: colors.accent }]}>
                <Text style={styles.typeText}>{WATER_LABEL[species.water_type] ?? species.water_type}</Text>
              </View>
              <View style={[styles.type, { backgroundColor: accent }]}>
                <Text style={styles.typeText}>{rarityLabel(species.rarity).toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.measures}>
          <View style={styles.measure}>
            <DexText size="small" muted>
              LONGITUD
            </DexText>
            <DexText>{range(formatLength(species.approx_min_length_cm), formatLength(species.approx_max_length_cm))}</DexText>
          </View>
          <View style={styles.measure}>
            <DexText size="small" muted>
              PESO
            </DexText>
            <DexText>{range(formatWeight(species.min_weight_kg), formatWeight(species.max_weight_kg))}</DexText>
          </View>
        </View>

        <View style={styles.entryText}>
          <DexText>{species.description}</DexText>
        </View>
      </View>

      <View style={styles.body}>
        <SegmentedTabs options={TABS} value={activeTab} onChange={setActiveTab} />
        <View style={styles.tabContent}>
          {activeTab === "info" && <InfoTab species={species} />}
          {activeTab === "capturas" && <CapturesTab captures={captures} />}
          {activeTab === "mapa" && <MapTab captures={captures} />}
          {activeTab === "records" && <RecordsTab speciesId={species.id} />}
        </View>
      </View>
    </ScrollView>
    </DexScreen>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function InfoTab({ species }: { species: FishSpeciesDetail }) {
  const styles = useStyles(makeStyles);
  // Principio del proyecto: nunca se inventa un dato legal.
  const verifiedRegulation = species.regulations.find((r) => r.legal_min_length_cm != null);
  const closedSeason = species.regulations.find((r) => r.closed_season);
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <InfoRow icon="pin" label="Dónde se pesca" value={`${species.region} · ${species.habitat}`} />
        <View style={styles.divider} />
        <InfoRow
          icon="ruler"
          label="Talla mínima (ES)"
          value={verifiedRegulation ? formatLength(verifiedRegulation.legal_min_length_cm as number) : "Información no disponible"}
        />
        <View style={styles.divider} />
        <InfoRow icon="calendar" label="Veda" value={closedSeason?.closed_season ?? "Información no disponible"} />
        {species.catch_difficulty != null ? (
          <>
            <View style={styles.divider} />
            <InfoRow icon="hook" label="Dificultad de captura" value={`${species.catch_difficulty} / 10`} />
          </>
        ) : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Dato curioso</Text>
        <Text style={styles.paragraph}>{species.fun_fact}</Text>
      </Card>
      {species.origin === "AI" ? (
        <Text style={styles.aiNote}>
          Especie añadida a la FishDex por la IA al identificar la foto de un pescador. Su rareza se fijó según lo difícil
          que es pescarla y es la misma para todos.
        </Text>
      ) : null}
    </View>
  );
}

function CapturesTab({ captures }: { captures: CapturePublic[] }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (captures.length === 0) {
    return <EmptyState icon="hook" title="Aún no has capturado esta especie" description="Cuando la captures, aparecerá aquí." />;
  }
  const sorted = [...captures].sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
  return (
    <View style={{ gap: spacing.sm }}>
      {sorted.map((capture) => {
        const thumb = mediaUrl(capture.thumbnail_url ?? capture.image_url ?? undefined);
        return (
          <Card key={capture.id} onPress={() => router.push(`/capture/${capture.id}`)} style={styles.captureCard}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.captureThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.captureThumb, styles.thumbEmpty]}>
                <Icon name="fish" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.captureMeta}>
                {formatWeight(capture.weight_kg)} · {formatLength(capture.length_cm)}
              </Text>
              <Text style={styles.captureDate}>
                {formatDate(capture.captured_at)} · {formatTime(capture.captured_at)}
              </Text>
              {capture.location_name ? <Text style={styles.captureDate}>{capture.location_name}</Text> : null}
            </View>
            {capture.is_personal_record_weight && !capture.is_new_species ? (
              <Icon name="trophy" size={18} color={colors.warning} />
            ) : null}
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Card>
        );
      })}
    </View>
  );
}

function MapTab({ captures }: { captures: CapturePublic[] }) {
  const styles = useStyles(makeStyles);
  const withCoords = captures.filter(
    (c): c is CapturePublic & { latitude: number; longitude: number } => c.latitude != null && c.longitude != null
  );
  if (withCoords.length === 0) {
    return <EmptyState icon="map" title="Sin ubicaciones guardadas" description="Ninguna de tus capturas de esta especie tiene coordenadas." />;
  }
  return (
    <View style={styles.mapWrap}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === "android" ? PROVIDER_DEFAULT : undefined}
        initialRegion={{ latitude: withCoords[0].latitude, longitude: withCoords[0].longitude, latitudeDelta: 4, longitudeDelta: 4 }}
      >
        {withCoords.map((capture) => (
          <Marker
            key={capture.id}
            coordinate={{ latitude: capture.latitude, longitude: capture.longitude }}
            title={capture.location_name ?? undefined}
            onCalloutPress={() => router.push(`/capture/${capture.id}`)}
          />
        ))}
      </MapView>
    </View>
  );
}

function RecordsTab({ speciesId }: { speciesId: number }) {
  const styles = useStyles(makeStyles);
  const [page, setPage] = useState<RankingPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpeciesRanking(speciesId)
      .then(setPage)
      .catch((err) => setError(extractErrorMessage(err)));
  }, [speciesId]);

  if (error) return <EmptyState icon="alert" title="No se ha podido cargar" description={error} />;
  if (!page) return <LoadingScreen message="Cargando récords..." />;
  if (page.entries.length === 0) return <EmptyState icon="trophy" title="Nadie la ha pescado aún" description="¡Sé el primero!" />;
  return (
    <Card>
      {page.entries.slice(0, 10).map((entry) => (
        <View key={entry.user.id} style={styles.recordRow}>
          <Text style={styles.recordPos}>{entry.position}</Text>
          <Avatar uri={entry.user.avatar} name={entry.user.display_name} size={30} />
          <Text style={styles.recordName} numberOfLines={1}>
            {entry.user.display_name}
          </Text>
          <Text style={styles.recordValue}>{formatWeight(entry.value)}</Text>
        </View>
      ))}
      {page.me && page.me.position > 10 ? (
        <View style={[styles.recordRow, styles.recordMe]}>
          <Text style={styles.recordPos}>{page.me.position}</Text>
          <Text style={styles.recordName}>Tú</Text>
          <Text style={styles.recordValue}>{formatWeight(page.me.value)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    entry: { margin: spacing.sm, padding: spacing.sm + 2, backgroundColor: c.surface, borderWidth: 2, borderBottomWidth: 4, borderColor: c.border, borderRadius: radius.md },
    entryTop: { flexDirection: "row", gap: spacing.md },
    sprite: {
      width: 120,
      height: 120,
      borderRadius: 8,
      borderWidth: 3,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    spriteImage: { width: "100%", height: "100%" },
    entryInfo: { flex: 1, justifyContent: "center", gap: 4 },
    types: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    type: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1.5, borderColor: c.border },
    typeText: { fontFamily: fonts.pixel, fontSize: 7, color: "#FFFFFF" },
    measures: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    measure: { flex: 1, borderWidth: 2, borderColor: c.border, borderRadius: 6, padding: spacing.xs + 2, gap: 2 },
    entryText: { marginTop: spacing.md, borderTopWidth: 2, borderTopColor: c.border, borderStyle: "dashed", paddingTop: spacing.sm },
    body: { paddingHorizontal: spacing.sm, marginTop: spacing.sm },
    tabContent: { marginTop: spacing.md },
    infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingVertical: spacing.xs },
    infoLabel: { ...typography.caption, color: c.textMuted },
    infoValue: { ...typography.bodyMedium, color: c.textPrimary, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.sm },
    cardTitle: { ...typography.sectionTitle, color: c.textPrimary, marginBottom: spacing.xs },
    paragraph: { ...typography.body, color: c.textSecondary },
    aiNote: { ...typography.caption, color: c.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
    captureCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    captureThumb: { width: 56, height: 56, borderRadius: radius.sm },
    thumbEmpty: { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    captureMeta: { ...typography.subtitle, fontSize: 15, color: c.textPrimary },
    captureDate: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
    mapWrap: { height: 280, borderRadius: radius.md, borderWidth: 2, borderColor: c.border, overflow: "hidden" },
    recordRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    recordMe: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    recordPos: { fontFamily: fonts.pixel, fontSize: 10, color: c.textMuted, width: 26 },
    recordName: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    recordValue: { ...typography.subtitle, fontSize: 15, color: c.textPrimary },
  });
