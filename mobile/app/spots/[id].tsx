import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { FriendPicker } from "@/components/FriendPicker";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { WeatherCard } from "@/components/WeatherCard";
import { radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import { getFriends } from "@/services/friendService";
import { pickFromGallery, takePhoto } from "@/services/imageService";
import { addSpotPhoto, deleteSpot, deleteSpotPhoto, getSpot, getSpotWeather, shareSpot, updateSpot } from "@/services/spotService";
import { formatDate } from "@/utils/format";
import { Spot, User, WeatherInfo } from "@/types";

/** Detalle de un spot: mapa, notas, fotos, condiciones actuales y, si es
 * tuyo, edición y con qué amigos concretos lo compartes. */
export default function SpotDetailScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const [sharing, setSharing] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [shareDraft, setShareDraft] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const spotId = Number(id);
    if (!spotId) {
      setError("Spot no válido.");
      setLoading(false);
      return;
    }
    try {
      const data = await getSpot(spotId);
      setSpot(data);
      getSpotWeather(spotId).then(setWeather).catch(() => undefined);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DexScreen title="Spot" onBack={() => router.back()}><LoadingScreen /></DexScreen>;
  if (error || !spot) return <DexScreen title="Spot" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar el spot" description={error ?? undefined} /></DexScreen>;

  const run = async (action: () => Promise<Spot>) => {
    setBusy(true);
    try {
      setSpot(await action());
      return true;
    } catch (err) {
      Alert.alert("No se ha podido completar", extractErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addPhoto = () => {
    Alert.alert("Añadir foto", undefined, [
      { text: "Cámara", onPress: async () => { const uri = await takePhoto(); if (uri) run(() => addSpotPhoto(spot.id, uri)); } },
      { text: "Galería", onPress: async () => { const uri = await pickFromGallery(); if (uri) run(() => addSpotPhoto(spot.id, uri)); } },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const openSharing = async () => {
    setShareDraft(new Set(spot.shared_with));
    setSharing(true);
    try {
      setFriends((await getFriends()).map((f) => f.user));
    } catch {
      setFriends([]);
    }
  };

  const remove = () =>
    Alert.alert("Borrar spot", "Se borrarán el spot y sus fotos. ¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSpot(spot.id);
            router.back();
          } catch (err) {
            Alert.alert("No se ha podido borrar", extractErrorMessage(err));
          }
        },
      },
    ]);

  return (
    <DexScreen title="Spot" counter={spot.is_mine ? (spot.shared_with.length ? "Compartido" : "Privado") : `De ${spot.owner.display_name}`} onBack={() => router.back()}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: spot.name }} />
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === "android" ? PROVIDER_DEFAULT : undefined}
          initialRegion={{ latitude: spot.latitude, longitude: spot.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        >
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
          <Marker coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} />
        </MapView>
      </View>

      {!editing ? (
        <Card style={{ gap: spacing.xs }}>
          <Text style={styles.title}>{spot.name}</Text>
          <Text style={styles.meta}>
            {spot.is_mine
              ? spot.shared_with.length > 0
                ? `Compartido con ${spot.shared_with.length} amigo(s)`
                : "Privado: solo lo ves tú"
              : `Compartido contigo por ${spot.owner.display_name}`}{" "}
            · {formatDate(spot.created_at)}
          </Text>
          {spot.notes ? <Text style={styles.notes}>{spot.notes}</Text> : null}
        </Card>
      ) : (
        <Card>
          <TextField label="Nombre" value={name} onChangeText={setName} maxLength={80} />
          <TextField label="Notas" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
          <PrimaryButton
            label="Guardar"
            loading={busy}
            disabled={!name.trim()}
            onPress={async () => {
              if (await run(() => updateSpot(spot.id, { name: name.trim(), notes: notes.trim() || null }))) setEditing(false);
            }}
          />
          <Pressable onPress={() => setEditing(false)} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Card>
      )}

      {weather ? <WeatherCard weather={weather} title="Condiciones ahora" /> : null}

      <Text style={styles.overline}>FOTOS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {spot.photos.map((photo) => (
          <Pressable
            key={photo.id}
            onLongPress={
              spot.is_mine
                ? () =>
                    Alert.alert("Borrar foto", undefined, [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Borrar", style: "destructive", onPress: () => run(() => deleteSpotPhoto(spot.id, photo.id)) },
                    ])
                : undefined
            }
          >
            <Image source={{ uri: mediaUrl(photo.thumbnail_url) }} style={styles.photo} />
          </Pressable>
        ))}
        {spot.is_mine ? (
          <Pressable onPress={addPhoto} style={[styles.photo, styles.addPhoto]} disabled={busy}>
            <Icon name="camera" size={22} color={colors.textMuted} />
            <Text style={styles.meta}>Añadir</Text>
          </Pressable>
        ) : null}
        {!spot.is_mine && spot.photos.length === 0 ? <Text style={styles.meta}>Sin fotos.</Text> : null}
      </ScrollView>

      {spot.is_mine ? (
        <View style={{ gap: spacing.sm }}>
          <PrimaryButton label="Compartir con amigos" icon="users" onPress={openSharing} />
          <View style={styles.row2}>
            <PrimaryButton
              label="Editar"
              icon="edit"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setName(spot.name);
                setNotes(spot.notes ?? "");
                setEditing(true);
              }}
            />
            <PrimaryButton label="Borrar" icon="trash" variant="danger" style={{ flex: 1 }} onPress={remove} />
          </View>
        </View>
      ) : null}

      <Modal visible={sharing} transparent animationType="slide" onRequestClose={() => setSharing(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>compartir spot.</Text>
            <Text style={styles.meta}>Solo los amigos que marques verán la ubicación exacta.</Text>
            <ScrollView style={{ maxHeight: 360, marginVertical: spacing.md }}>
              <FriendPicker
                friends={friends}
                selected={shareDraft}
                onToggle={(friendId) =>
                  setShareDraft((prev) => {
                    const next = new Set(prev);
                    if (next.has(friendId)) next.delete(friendId);
                    else next.add(friendId);
                    return next;
                  })
                }
              />
            </ScrollView>
            <PrimaryButton
              label="Guardar"
              loading={busy}
              onPress={async () => {
                if (await run(() => shareSpot(spot.id, Array.from(shareDraft)))) setSharing(false);
              }}
            />
            <Pressable onPress={() => setSharing(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    mapWrap: { height: 200, borderRadius: radius.xl, overflow: "hidden" },
    title: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    meta: { ...typography.caption, color: c.textSecondary },
    notes: { ...typography.body, color: c.textPrimary, marginTop: spacing.sm },
    overline: { ...typography.overline, color: c.textMuted },
    photos: { gap: spacing.sm },
    photo: { width: 110, height: 110, borderRadius: radius.sm, borderWidth: 2, borderColor: c.border },
    addPhoto: { borderWidth: 1.5, borderStyle: "dashed", borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", gap: 4 },
    row2: { flexDirection: "row", gap: spacing.sm },
    cancel: { alignItems: "center", marginTop: spacing.md },
    cancelText: { ...typography.bodyMedium, color: c.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" },
    modalSheet: { backgroundColor: c.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
    modalTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
  });
