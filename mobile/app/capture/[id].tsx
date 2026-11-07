import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { Icon, IconName } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RarityBadge } from "@/components/RarityBadge";
import { ShareCaptureModal } from "@/components/ShareCaptureModal";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { TextField } from "@/components/TextField";
import { WeatherCard } from "@/components/WeatherCard";
import { fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import { deleteCapture, getCapture, updateCapture } from "@/services/captureService";
import { getSpeciesCatalog } from "@/services/fishService";
import { formatDateTime, formatLength, formatWeight } from "@/utils/format";
import { CapturePublic, FishCatalogEntry } from "@/types";

function toInput(value: number): string {
  return String(value).replace(".", ",");
}

/** Detalle de una captura propia: ver, corregir (el ELO se recalcula en el
 * servidor), borrar y compartir como imagen. */
export default function CaptureDetailScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [capture, setCapture] = useState<CapturePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const [catalog, setCatalog] = useState<FishCatalogEntry[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [species, setSpecies] = useState<FishCatalogEntry | null>(null);
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [bait, setBait] = useState("");
  const [place, setPlace] = useState("");

  useEffect(() => {
    const captureId = Number(id);
    if (!captureId) {
      setError("Captura no válida.");
      setLoading(false);
      return;
    }
    getCapture(captureId)
      .then(setCapture)
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const startEditing = () => {
    if (!capture) return;
    setWeight(toInput(capture.weight_kg));
    setLength(toInput(capture.length_cm));
    setBait(capture.bait_technique ?? "");
    setPlace(capture.location_name ?? "");
    setSpecies(null);
    if (catalog.length === 0) getSpeciesCatalog().then(setCatalog).catch(() => undefined);
    setEditing(true);
  };

  const save = async () => {
    if (!capture) return;
    const weightValue = Number(weight.replace(",", "."));
    const lengthValue = Number(length.replace(",", "."));
    if (!weightValue || weightValue <= 0 || weightValue > 500) return Alert.alert("Peso no válido", "Introduce un peso entre 0 y 500 kg.");
    if (!lengthValue || lengthValue <= 0 || lengthValue > 1000) return Alert.alert("Longitud no válida", "Introduce una longitud entre 0 y 1000 cm.");
    setSaving(true);
    try {
      const updated = await updateCapture(capture.id, {
        ...(species ? { fish_species_id: species.id } : {}),
        weight_kg: weightValue,
        length_cm: lengthValue,
        bait_technique: bait.trim() || null,
        location_name: place.trim() || null,
      });
      setCapture(updated);
      setEditing(false);
      refreshUser();
      Alert.alert("Captura corregida", "El ELO de tu historial se ha recalculado.");
    } catch (err) {
      Alert.alert("No se ha podido guardar", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!capture) return;
    Alert.alert("Borrar captura", "Se borrará la captura y su foto, y se recalculará tu ELO. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCapture(capture.id);
            refreshUser();
            router.back();
          } catch (err) {
            Alert.alert("No se ha podido borrar", extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) return <DexScreen title="Captura" onBack={() => router.back()}><LoadingScreen /></DexScreen>;
  if (error || !capture) return <DexScreen title="Captura" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar la captura" description={error ?? undefined} /></DexScreen>;

  const photo = mediaUrl(capture.image_url ?? capture.thumbnail_url ?? undefined);

  return (
    <DexScreen title="Captura" counter={capture.fish_species_name} onBack={() => router.back()}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: capture.fish_species_name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <Icon name="fish" size={48} color={colors.textMuted} />
          </View>
        )}

        {!editing ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{capture.fish_species_name.toUpperCase()}</Text>
                <RarityBadge rarity={capture.rarity} size="sm" />
              </View>
              <Row icon="weight" label="Peso" value={formatWeight(capture.weight_kg)} />
              <Row icon="ruler" label="Longitud" value={formatLength(capture.length_cm)} />
              <Row icon="calendar" label="Fecha" value={formatDateTime(capture.captured_at)} />
              {capture.location_name ? <Row icon="pin" label="Lugar" value={capture.location_name} /> : null}
              {capture.bait_technique ? <Row icon="hook" label="Cebo / técnica" value={capture.bait_technique} /> : null}
              <Row icon="star" label="ELO obtenido" value={`+${capture.elo_earned}`} />
              {capture.is_new_species ? <Text style={styles.flag}>Primera captura de la especie</Text> : null}
              {!capture.is_new_species && (capture.is_personal_record_weight || capture.is_personal_record_length) ? (
                <Text style={styles.flag}>Récord personal en su momento</Text>
              ) : null}
            </Card>
            {capture.weather ? <WeatherCard weather={capture.weather} title="Condiciones al pescarla" /> : null}
            <PrimaryButton label="Compartir" icon="share" onPress={() => setShareVisible(true)} />
            <View style={styles.row2}>
              <PrimaryButton label="Corregir" icon="edit" variant="secondary" onPress={startEditing} style={{ flex: 1 }} />
              <PrimaryButton label="Borrar" icon="trash" variant="danger" onPress={remove} style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <Card>
            <Text style={styles.editTitle}>corregir captura.</Text>
            <Text style={styles.editHint}>Al guardar se recalcula el ELO de todo tu historial.</Text>
            <Pressable style={styles.speciesRow} onPress={() => setPickerVisible(true)}>
              <Text style={styles.speciesText}>{species?.name ?? capture.fish_species_name}</Text>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
            <View style={styles.row2}>
              <TextField label="Peso (kg)" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} />
              <TextField label="Longitud (cm)" value={length} onChangeText={setLength} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} />
            </View>
            <TextField label="Lugar" value={place} onChangeText={setPlace} maxLength={150} />
            <TextField label="Cebo / técnica" value={bait} onChangeText={setBait} maxLength={120} />
            <PrimaryButton label="Guardar cambios" onPress={save} loading={saving} />
            <Pressable onPress={() => setEditing(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </Card>
        )}
      </ScrollView>

      <SpeciesPicker
        visible={pickerVisible}
        species={catalog}
        onSelect={(s) => {
          setSpecies(s);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
      <ShareCaptureModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        capture={
          user
            ? {
                fish_species_name: capture.fish_species_name,
                rarity: capture.rarity,
                weight_kg: capture.weight_kg,
                length_cm: capture.length_cm,
                captured_at: capture.captured_at,
                location_name: capture.location_name,
                image_url: capture.image_url,
                angler_name: user.display_name,
                rank_name: user.rank.name,
              }
            : null
        }
      />
    </KeyboardAvoidingView>
    </DexScreen>
  );
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, borderWidth: 2, borderColor: c.border },
    photoEmpty: { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.xs },
    title: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 18, color: c.textPrimary, flex: 1 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    infoLabel: { ...typography.caption, color: c.textSecondary, flex: 1 },
    infoValue: { ...typography.bodyMedium, color: c.textPrimary, flexShrink: 1 },
    flag: { ...typography.caption, color: c.accent },
    row2: { flexDirection: "row", gap: spacing.sm },
    editTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    editHint: { ...typography.caption, color: c.textSecondary, marginBottom: spacing.md },
    speciesRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      marginBottom: spacing.md,
      backgroundColor: c.surface,
    },
    speciesText: { ...typography.body, color: c.textPrimary, flex: 1 },
    cancel: { alignItems: "center", marginTop: spacing.md },
    cancelText: { ...typography.bodyMedium, color: c.textSecondary },
  });
