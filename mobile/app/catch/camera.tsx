import { CameraView, useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import React, { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { darkColors as colors, radius, spacing, typography } from "@/constants/theme";
import { compress, pickFromGallery } from "@/services/imageService";
import { setPendingPhoto } from "@/services/pendingPhoto";

/** Capas de zoom mostradas como cápsulas "0,5" / "1x" / "2", al estilo del
 * selector de focales de una cámara de teléfono. `expo-camera` no permite
 * cambiar de lente física: solo expone un zoom digital de 0 (sin zoom) a 1
 * (zoom máximo del dispositivo). Estos tres niveles son, por tanto, una
 * ==aproximación== a "gran angular / normal / tele" usando ese único rango,
 * no un cambio real de objetivo. */
const ZOOM_LEVELS: { label: string; zoom: number }[] = [
  { label: "0,5", zoom: 0 },
  { label: "1x", zoom: 0.25 },
  { label: "2", zoom: 0.5 },
];

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [flash, setFlash] = useState<"off" | "on">("off");
  const [zoomIndex, setZoomIndex] = useState(1);
  const [capturing, setCapturing] = useState(false);
  const [galleryPreview, setGalleryPreview] = useState<string | null>(null);

  const handleClose = () => router.back();

  const handleToggleFlash = () => setFlash((prev) => (prev === "off" ? "on" : "off"));

  const handleShutter = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) return;
      const compressedUri = await compress(photo.uri);
      setPendingPhoto(compressedUri);
      router.back();
    } catch {
      // Si falla la captura simplemente se deja al usuario intentarlo de
      // nuevo; no hay nada que informar aquí que no sea obvio por la UI.
    } finally {
      setCapturing(false);
    }
  };

  const handlePickGallery = async () => {
    const uri = await pickFromGallery();
    if (!uri) return;
    setGalleryPreview(uri);
    setPendingPhoto(uri);
    router.back();
  };

  if (!permission) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LoadingScreen message="Comprobando permisos de cámara..." />
      </>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <EmptyState
          icon="camera"
          title="Necesitamos acceso a tu cámara"
          description="FishDex usa la cámara para fotografiar tus capturas. Concede el permiso para poder hacer la foto."
        />
        <View style={styles.permissionActions}>
          {permission.canAskAgain ? (
            <PrimaryButton label="Conceder permiso" onPress={requestPermission} />
          ) : (
            <PrimaryButton label="Abrir ajustes" onPress={() => Linking.openSettings()} />
          )}
          <PrimaryButton label="Volver" variant="secondary" onPress={handleClose} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flash}
        zoom={ZOOM_LEVELS[zoomIndex].zoom}
      />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={handleClose} style={styles.roundButton}>
          <Icon name="close" size={20} color={colors.textOnDark} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flash"
          onPress={handleToggleFlash}
          style={[styles.roundButton, flash === "on" && styles.roundButtonActive]}
        >
          <Icon
            name={flash === "on" ? "flash" : "flash-off"}
            size={20}
            color={flash === "on" ? colors.warning : colors.textOnDark}
          />
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.zoomRow}>
          {ZOOM_LEVELS.map((level, index) => {
            const active = index === zoomIndex;
            return (
              <Pressable
                key={level.label}
                onPress={() => setZoomIndex(index)}
                style={[styles.zoomPill, active && styles.zoomPillActive]}
              >
                <Text style={[styles.zoomLabel, active && styles.zoomLabelActive]}>{level.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.controlsRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir galería" onPress={handlePickGallery} style={styles.galleryThumb}>
            {galleryPreview ? (
              <Image source={{ uri: galleryPreview }} style={styles.galleryThumbImage} />
            ) : (
              <Icon name="gallery" size={22} color={colors.textOnDark} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hacer foto"
            onPress={handleShutter}
            disabled={capturing}
            style={({ pressed }) => [styles.shutterRing, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <View style={styles.controlsSpacer} />
        </View>

        <View style={styles.modeRow}>
          <Text style={[styles.modeLabel, styles.modeLabelActive]}>FOTO</Text>
          <Pressable onPress={handlePickGallery}>
            <Text style={styles.modeLabel}>GALERÍA</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  permissionContainer: { flex: 1, backgroundColor: colors.background, justifyContent: "center" },
  permissionActions: { paddingHorizontal: spacing.lg },

  topBar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundButtonActive: { backgroundColor: "rgba(255,255,255,0.35)" },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: spacing.md,
  },
  zoomRow: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.lg,
  },
  zoomPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  zoomPillActive: { backgroundColor: "#FFFFFF" },
  zoomLabel: { ...typography.caption, color: "#FFFFFF" },
  zoomLabelActive: { color: "#111111", fontWeight: "700" },

  controlsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
  },
  galleryThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  galleryThumbImage: { width: "100%", height: "100%" },
  controlsSpacer: { width: 48 },

  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFFFFF",
  },

  modeRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  modeLabel: { ...typography.caption, color: "rgba(255,255,255,0.6)", letterSpacing: 1 },
  modeLabelActive: { color: "#FFFFFF", fontWeight: "700", textDecorationLine: "underline" },
});
