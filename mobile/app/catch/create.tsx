import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { CelebrationModal } from "@/components/CelebrationModal";
import { DexScreen } from "@/components/DexScreen";
import { Icon, IconName } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RarityBadge } from "@/components/RarityBadge";
import { RegulationNotice } from "@/components/RegulationNotice";
import { ShareableCapture, ShareCaptureModal } from "@/components/ShareCaptureModal";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { TextField } from "@/components/TextField";
import { WeatherCard } from "@/components/WeatherCard";
import { fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { identifyFish } from "@/services/aiService";
import { createCapture } from "@/services/captureService";
import { getSpeciesCatalog } from "@/services/fishService";
import { Coordinates, getCurrentCoordinates, reverseGeocodePlaceName } from "@/services/locationService";
import { consumePendingPhoto } from "@/services/pendingPhoto";
import { checkRegulation, getWeather } from "@/services/weatherService";
import { formatDate, formatTime } from "@/utils/format";
import { AIIdentifyResponse, CaptureResult, FishCatalogEntry, RegulationCheck, WeatherInfo } from "@/types";

const STEP_LABELS = ["Foto", "Datos", "Ubicación", "Revisar"] as const;
const LAST_STEP = STEP_LABELS.length - 1;

// Mismos límites que valida el backend (`CaptureCreate`): comprobarlos aquí
// evita encolar sin conexión una captura que el servidor rechazaría después.
const MAX_WEIGHT_KG = 500;
const MAX_LENGTH_CM = 1000;

/** "3.4" -> "3,4" para mostrar las estimaciones de la IA en formato español. */
function toInput(value: number | null): string {
  if (value == null) return "";
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

export default function CreateCaptureScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<FishCatalogEntry[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [species, setSpecies] = useState<FishCatalogEntry | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [baitTechnique, setBaitTechnique] = useState("");
  // Fecha/hora fijadas al abrir el formulario (solo lectura).
  const [capturedAt] = useState(() => new Date());

  // --- IA: qué campos ha rellenado ella (el usuario puede cambiarlos) ---
  const [ai, setAi] = useState<AIIdentifyResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState({ species: false, weight: false, length: false });
  const analyzedUriRef = useRef<string | null>(null);
  // Espejo de `aiFilled` para leerlo dentro de `analyze` sin recrearlo.
  const aiFilledRef = useRef(aiFilled);
  aiFilledRef.current = aiFilled;
  const hasManualValue = useRef({ species: false, weight: false, length: false });

  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [regulation, setRegulation] = useState<RegulationCheck | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSpeciesCatalog()
      .then((data) => !cancelled && setCatalog(data))
      .catch(() => !cancelled && setCatalog([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const analyze = useCallback(async (uri: string) => {
    analyzedUriRef.current = uri;
    setAiLoading(true);
    setAi(null);
    try {
      const response = await identifyFish(uri);
      if (analyzedUriRef.current !== uri) return; // se cambió la foto mientras tanto
      setAi(response);
      if (!response.identified) return;
      // Autocompleta, pero sin pisar lo que el usuario ya escribió a mano.
      const manual = hasManualValue.current;
      const next = { ...aiFilledRef.current };
      if (response.species && !manual.species) {
        const suggested = response.species;
        setSpecies(suggested);
        setCatalog((current) => (current.some((s) => s.id === suggested.id) ? current : [...current, suggested]));
        next.species = true;
      }
      if (response.estimated_weight_kg != null && !manual.weight) {
        setWeight(toInput(response.estimated_weight_kg));
        next.weight = true;
      }
      if (response.estimated_length_cm != null && !manual.length) {
        setLength(toInput(response.estimated_length_cm));
        next.length = true;
      }
      setAiFilled(next);
    } catch {
      if (analyzedUriRef.current === uri) {
        setAi({
          available: false,
          identified: false,
          message: "No se ha podido contactar con la IA. Rellena los datos a mano.",
          species: null,
          species_is_new_in_catalog: false,
          suggested_name: null,
          scientific_name: null,
          confidence: null,
          estimated_weight_kg: null,
          estimated_length_cm: null,
          catch_difficulty: null,
        });
      }
    } finally {
      if (analyzedUriRef.current === uri) setAiLoading(false);
    }
  }, []);

  // Recoge la foto tomada en /catch/camera y la analiza con la IA.
  useFocusEffect(
    useCallback(() => {
      const uri = consumePendingPhoto();
      if (uri) {
        setPhotoUri(uri);
        analyze(uri);
      }
    }, [analyze])
  );

  const handleUseGps = async () => {
    setLocatingGps(true);
    const coords = await getCurrentCoordinates();
    if (!coords) {
      setLocatingGps(false);
      Alert.alert("Ubicación no disponible", "No se ha podido obtener el GPS. Puedes guardar la captura sin ubicación.");
      return;
    }
    setCoordinates(coords);
    setLocationName(null);
    setWeather(null);
    const [name, conditions] = await Promise.all([
      reverseGeocodePlaceName(coords),
      getWeather(coords.latitude, coords.longitude).catch(() => null),
    ]);
    setLocationName(name);
    setWeather(conditions);
    setLocatingGps(false);
  };

  const weightValue = Number(weight.replace(",", "."));
  const lengthValue = Number(length.replace(",", "."));

  const dataStepError = useMemo((): string | null => {
    if (!species) return "Selecciona qué especie has pescado.";
    if (!weightValue || weightValue <= 0) return "Introduce un peso válido.";
    if (weightValue > MAX_WEIGHT_KG) return `El peso no puede superar ${MAX_WEIGHT_KG} kg.`;
    if (!lengthValue || lengthValue <= 0) return "Introduce una longitud válida.";
    if (lengthValue > MAX_LENGTH_CM) return `La longitud no puede superar ${MAX_LENGTH_CM} cm.`;
    return null;
  }, [species, weightValue, lengthValue]);

  // Avisos legales al llegar a "Revisar" (veda, talla mínima, cupo).
  useEffect(() => {
    if (step !== LAST_STEP || !species) return;
    let cancelled = false;
    setRegulation(null);
    checkRegulation({
      species_id: species.id,
      length_cm: lengthValue || null,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
    })
      .then((data) => !cancelled && setRegulation(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [step, species, lengthValue, coordinates]);

  const goToNextStep = () => {
    if (step === 1 && dataStepError) {
      Alert.alert("Faltan datos", dataStepError);
      return;
    }
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const handleHeaderBack = () => {
    if (step > 0) setStep((s) => s - 1);
    else router.back();
  };

  const handleSubmit = async () => {
    if (dataStepError) {
      Alert.alert("Faltan datos", dataStepError);
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await createCapture({
        fish_species_id: species!.id,
        weight_kg: weightValue,
        length_cm: lengthValue,
        captured_at: capturedAt.toISOString(),
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        location_name: locationName,
        bait_technique: baitTechnique.trim() ? baitTechnique.trim() : null,
        image_uri: photoUri,
      });
      if (outcome.status === "synced") {
        setResult(outcome.result);
        setCelebrationVisible(true);
      } else {
        Alert.alert(
          "Sin conexión",
          "Tu captura se ha guardado en el dispositivo y se sincronizará (con su ELO correspondiente) en cuanto tengas conexión."
        );
        router.back();
      }
    } catch (error) {
      Alert.alert("No se pudo registrar la captura", error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = step === LAST_STEP;
  const shareable: ShareableCapture | null =
    result && user
      ? {
          fish_species_name: result.capture.fish_species_name,
          rarity: result.capture.rarity,
          weight_kg: result.capture.weight_kg,
          length_cm: result.capture.length_cm,
          captured_at: result.capture.captured_at,
          location_name: result.capture.location_name,
          image_url: result.capture.image_url,
          local_image_uri: photoUri,
          angler_name: user.display_name,
          rank_name: result.rank,
        }
      : null;

  return (
    <DexScreen
      title="Nueva captura"
      counter={`Paso ${step + 1}/${STEP_LABELS.length} · ${STEP_LABELS[step]}`}
      onBack={handleHeaderBack}
    >
      <View style={styles.stepperRow}>
        {STEP_LABELS.map((label, i) => (
          <View key={label} style={styles.stepperItem}>
            <View style={[styles.stepBar, i <= step && styles.stepBarDone]} />
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Pressable onPress={() => router.push("/catch/camera")} style={styles.photoFrame}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoDashed}>
                  <Icon name="camera" size={32} color={colors.textMuted} />
                  <Text style={styles.photoDashedText}>Haz una foto y la IA reconocerá el pez</Text>
                </View>
              )}
            </Pressable>
            <PrimaryButton
              label={photoUri ? "Cambiar foto" : "Hacer foto"}
              icon="camera"
              variant="secondary"
              onPress={() => router.push("/catch/camera")}
              style={{ marginTop: spacing.md }}
            />
            {photoUri ? <AIPanel ai={ai} loading={aiLoading} onRetry={() => analyze(photoUri)} /> : null}
          </View>
        )}

        {step === 1 && (
          <View>
            {ai?.identified ? (
              <View style={styles.aiHint}>
                <Icon name="sparkle" size={14} color={colors.accent} />
                <Text style={styles.aiHintText}>Los campos marcados con «IA» son una estimación: corrígelos si hace falta.</Text>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>
              ESPECIE{aiFilled.species ? <Text style={styles.aiTag}>  · IA</Text> : null}
            </Text>
            <Pressable style={[styles.fieldRow, aiFilled.species && styles.fieldRowAi]} onPress={() => setPickerVisible(true)}>
              <Text style={[styles.fieldRowValue, !species && { color: colors.textMuted }]} numberOfLines={1}>
                {species ? species.name : "Selecciona una especie"}
              </Text>
              {species ? <RarityBadge rarity={species.rarity} size="sm" /> : null}
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={styles.twoColRow}>
              <TextField
                label="Peso (kg)"
                value={weight}
                onChangeText={(v) => {
                  setWeight(v);
                  hasManualValue.current.weight = true;
                  setAiFilled((p) => ({ ...p, weight: false }));
                }}
                aiFilled={aiFilled.weight}
                keyboardType="decimal-pad"
                placeholder="3,42"
                containerStyle={styles.halfField}
              />
              <TextField
                label="Longitud (cm)"
                value={length}
                onChangeText={(v) => {
                  setLength(v);
                  hasManualValue.current.length = true;
                  setAiFilled((p) => ({ ...p, length: false }));
                }}
                aiFilled={aiFilled.length}
                keyboardType="decimal-pad"
                placeholder="67"
                containerStyle={styles.halfField}
              />
            </View>

            <View style={styles.twoColRow}>
              <TextField
                label="Fecha"
                value={formatDate(capturedAt.toISOString())}
                editable={false}
                adornment={<Icon name="calendar" size={16} color={colors.textMuted} />}
                containerStyle={styles.halfField}
              />
              <TextField
                label="Hora"
                value={formatTime(capturedAt.toISOString())}
                editable={false}
                adornment={<Icon name="clock" size={16} color={colors.textMuted} />}
                containerStyle={styles.halfField}
              />
            </View>

            <TextField
              label="Cebo / Técnica (opcional)"
              value={baitTechnique}
              onChangeText={setBaitTechnique}
              placeholder="Raglú / Spinning"
              maxLength={120}
            />
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: spacing.md }}>
            {coordinates ? (
              <View style={styles.miniMapWrapper}>
                <MapView
                  style={styles.miniMap}
                  provider={Platform.OS === "android" ? PROVIDER_DEFAULT : undefined}
                  initialRegion={{ ...coordinates, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
                  <Marker coordinate={coordinates}>
                    <View style={styles.miniMapPin} />
                  </Marker>
                </MapView>
              </View>
            ) : (
              <View style={[styles.miniMapWrapper, styles.miniMapEmpty]}>
                <Icon name="pin" size={32} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.locationName}>
              {coordinates ? locationName ?? "Buscando el nombre del lugar..." : "Aún no se ha obtenido la ubicación."}
            </Text>
            <PrimaryButton
              label={coordinates ? "Actualizar ubicación" : "Obtener ubicación GPS"}
              icon="locate"
              variant="secondary"
              onPress={handleUseGps}
              loading={locatingGps}
            />
            {weather ? <WeatherCard weather={weather} title="Condiciones ahora" /> : null}
            <Pressable onPress={goToNextStep} style={styles.skipLocationLink}>
              <Text style={styles.skipLocationText}>Registrar sin ubicación</Text>
            </Pressable>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: spacing.md }}>
            <Card style={styles.reviewCard}>
              <View style={styles.reviewPhotoRow}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.reviewPhoto} />
                ) : (
                  <View style={[styles.reviewPhoto, styles.reviewPhotoPlaceholder]}>
                    <Icon name="fish" size={28} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.reviewSpeciesName} numberOfLines={1}>
                    {species?.name ?? "Sin especie"}
                  </Text>
                  {species ? <RarityBadge rarity={species.rarity} size="sm" /> : null}
                </View>
              </View>
              <View style={styles.reviewDivider} />
              <ReviewRow icon="weight" label="Peso" value={weight ? `${weight.replace(".", ",")} kg` : "—"} />
              <ReviewRow icon="ruler" label="Longitud" value={length ? `${length.replace(".", ",")} cm` : "—"} />
              <ReviewRow icon="calendar" label="Fecha" value={`${formatDate(capturedAt.toISOString())} · ${formatTime(capturedAt.toISOString())}`} />
              <ReviewRow
                icon="pin"
                label="Ubicación"
                value={coordinates ? locationName ?? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : "Sin ubicación"}
              />
              {baitTechnique.trim() ? <ReviewRow icon="hook" label="Cebo / Técnica" value={baitTechnique.trim()} /> : null}
            </Card>
            {regulation ? <RegulationNotice check={regulation} /> : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={isLastStep ? "Guardar captura" : "Siguiente"}
          onPress={isLastStep ? handleSubmit : goToNextStep}
          loading={submitting}
          disabled={step === 0 && aiLoading}
        />
      </View>

      <SpeciesPicker
        visible={pickerVisible}
        species={catalog}
        onSelect={(s) => {
          setSpecies(s);
          hasManualValue.current.species = true;
          setAiFilled((p) => ({ ...p, species: false }));
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />

      <CelebrationModal
        visible={celebrationVisible}
        result={result}
        onShare={() => setShareVisible(true)}
        onViewInDex={() => {
          setCelebrationVisible(false);
          // Se sustituye el modal de captura por la ficha de la especie.
          if (result) router.replace(`/fishdex/${result.capture.fish_species_id}`);
          else router.back();
        }}
        onContinue={() => {
          setCelebrationVisible(false);
          router.back();
        }}
      />
      <ShareCaptureModal capture={shareable} visible={shareVisible} onClose={() => setShareVisible(false)} />
    </DexScreen>
  );
}

function AIPanel({ ai, loading, onRetry }: { ai: AIIdentifyResponse | null; loading: boolean; onRetry: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (loading) {
    return (
      <Card style={styles.aiCard}>
        <ActivityIndicator color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.aiTitle}>Analizando la foto...</Text>
          <Text style={styles.aiText}>La IA está identificando la especie y estimando su tamaño.</Text>
        </View>
      </Card>
    );
  }
  if (!ai) return null;
  return (
    <Card style={styles.aiCard}>
      <Icon name="sparkle" size={22} color={ai.identified ? colors.accent : colors.textMuted} filled={ai.identified} />
      <View style={{ flex: 1 }}>
        <Text style={styles.aiTitle}>
          {ai.identified ? ai.species?.name ?? ai.suggested_name : "Identificación por IA"}
        </Text>
        {ai.scientific_name ? <Text style={styles.aiScientific}>{ai.scientific_name}</Text> : null}
        <Text style={styles.aiText}>{ai.message}</Text>
        {ai.identified && ai.confidence != null ? (
          <Text style={styles.aiConfidence}>Confianza {Math.round(ai.confidence * 100)} %</Text>
        ) : null}
        {ai.available ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={styles.aiRetry}>Volver a analizar</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function ReviewRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowLabelWrap}>
        <Icon name={icon} size={16} color={colors.textMuted} />
        <Text style={styles.reviewRowLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.reviewRowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    round: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    stepCount: { fontFamily: fonts.pixel, fontSize: 8, color: c.textPrimary },
    stepperRow: { flexDirection: "row", gap: spacing.xs, padding: spacing.sm, paddingBottom: 0 },
    stepperItem: { flex: 1 },
    stepBar: { height: 10, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface },
    stepBarDone: { backgroundColor: c.cta },
    stepLabel: { ...typography.captionSmall, color: c.textMuted, marginTop: spacing.xs },
    stepLabelActive: { color: c.textPrimary, fontFamily: typography.subtitle.fontFamily },
    scroll: { flex: 1 },
    scrollContent: { padding: spacing.sm, paddingBottom: spacing.xl },
    photoFrame: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, borderWidth: 2, borderColor: c.border, overflow: "hidden", backgroundColor: c.surface },
    photoImage: { width: "100%", height: "100%" },
    photoDashed: {
      flex: 1,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: c.borderStrong,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    photoDashedText: { ...typography.caption, color: c.textMuted, marginTop: spacing.sm, textAlign: "center" },
    aiCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginTop: spacing.md },
    aiTitle: { ...typography.subtitle, color: c.textPrimary },
    aiScientific: { ...typography.scientific, color: c.textSecondary },
    aiText: { ...typography.body, fontSize: 14, color: c.textSecondary, marginTop: 2 },
    aiConfidence: { ...typography.caption, color: c.accent, marginTop: spacing.xs },
    aiRetry: { ...typography.caption, color: c.textPrimary, textDecorationLine: "underline", marginTop: spacing.sm },
    aiHint: { flexDirection: "row", gap: spacing.xs, alignItems: "center", backgroundColor: c.accentSoft, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
    aiHintText: { ...typography.caption, color: c.textPrimary, flex: 1 },
    aiTag: { color: c.accent },
    fieldLabel: { ...typography.overline, fontSize: 8, color: c.textSecondary, marginBottom: 6 },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 10,
      marginBottom: spacing.md,
    },
    fieldRowAi: { borderColor: c.accent, backgroundColor: c.accentSoft },
    fieldRowValue: { ...typography.body, color: c.textPrimary, flex: 1 },
    twoColRow: { flexDirection: "row", gap: spacing.md },
    halfField: { flex: 1 },
    miniMapWrapper: { width: "100%", height: 170, borderRadius: radius.md, borderWidth: 2, borderColor: c.border, overflow: "hidden", backgroundColor: c.surface },
    miniMap: { flex: 1 },
    miniMapEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.border },
    miniMapPin: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, borderWidth: 2, borderColor: c.surface },
    locationName: { ...typography.body, color: c.textSecondary },
    skipLocationLink: { alignItems: "center", marginTop: spacing.sm },
    skipLocationText: { ...typography.bodyMedium, color: c.textSecondary, textDecorationLine: "underline" },
    reviewCard: { gap: spacing.sm },
    reviewPhotoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    reviewPhoto: { width: 64, height: 64, borderRadius: radius.md },
    reviewPhotoPlaceholder: { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    reviewSpeciesName: { ...typography.subtitle, color: c.textPrimary },
    reviewDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: spacing.xs },
    reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
    reviewRowLabelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
    reviewRowLabel: { ...typography.caption, color: c.textSecondary, flex: 1 },
    reviewRowValue: { ...typography.bodyMedium, color: c.textPrimary, flexShrink: 1, textAlign: "right" },
    footer: { padding: spacing.sm, borderTopWidth: 2, borderTopColor: c.border, backgroundColor: c.background },
  });
