import * as Sharing from "expo-sharing";
import React, { useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { dex, fonts, radius, spacing } from "@/constants/theme";
import { useGameConfig } from "@/context/GameConfigContext";
import { mediaUrl } from "@/services/api";
import { formatDate, formatLength, formatWeight } from "@/utils/format";
import { Alert } from "@/utils/alert";

export interface ShareableCapture {
  fish_species_name: string;
  rarity: string;
  weight_kg: number;
  length_cm: number;
  captured_at: string;
  location_name: string | null;
  image_url: string | null;
  /** Foto local (recién hecha) si aún no hay URL del servidor. */
  local_image_uri?: string | null;
  angler_name: string;
  rank_name: string;
}

/** Vista previa de la tarjeta para compartir (foto + especie + medidas +
 * rango + marca FishDex) y botón que la convierte en imagen con
 * react-native-view-shot y abre la hoja de compartir del sistema. */
export function ShareCaptureModal({
  capture,
  visible,
  onClose,
}: {
  capture: ShareableCapture | null;
  visible: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const { rarityColor, rarityLabel } = useGameConfig();

  if (!capture) return null;
  const photo = capture.local_image_uri ?? mediaUrl(capture.image_url);
  const accent = rarityColor(capture.rarity);

  const handleShare = async () => {
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Compartir", "Este dispositivo no permite compartir imágenes.");
        return;
      }
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartir captura" });
    } catch {
      Alert.alert("Compartir", "No se ha podido generar la imagen.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={styles.close} hitSlop={12} accessibilityLabel="Cerrar">
          <Icon name="close" size={22} color="#FFFFFF" />
        </Pressable>

        <View ref={cardRef} collapsable={false} style={styles.card}>
          <View style={styles.photoWrap}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <Icon name="fish" size={56} color={dex.screenMuted} />
              </View>
            )}
            <View style={[styles.rarity, { backgroundColor: accent }]}>
              <Text style={styles.rarityText}>{rarityLabel(capture.rarity).toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.body}>
            <Text style={styles.species}>{capture.fish_species_name.toUpperCase()}</Text>
            <View style={styles.measures}>
              <Text style={styles.measure}>{formatWeight(capture.weight_kg)}</Text>
              <Text style={styles.measure}>{formatLength(capture.length_cm)}</Text>
            </View>
            <Text style={styles.meta}>
              {capture.angler_name} · {capture.rank_name}
            </Text>
            <Text style={styles.meta}>
              {formatDate(capture.captured_at)}
              {capture.location_name ? ` · ${capture.location_name}` : ""}
            </Text>
          </View>
          <View style={styles.footer}>
            <Text style={styles.brand}>FISHDEX</Text>
            <Text style={styles.brandSub}>la colección del pescador</Text>
          </View>
        </View>

        <PrimaryButton label="Compartir" icon="share" variant="light" onPress={handleShare} loading={sharing} style={styles.button} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  close: { position: "absolute", top: 56, right: 24 },
  card: { width: "100%", maxWidth: 360, backgroundColor: dex.shell, borderRadius: radius.xl, padding: spacing.md, borderWidth: 3, borderColor: dex.shellDark },
  photoWrap: { borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: dex.screenBorder },
  photo: { width: "100%", aspectRatio: 4 / 3 },
  photoEmpty: { backgroundColor: dex.screen, alignItems: "center", justifyContent: "center" },
  rarity: { position: "absolute", top: 10, left: 10, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  rarityText: { fontFamily: fonts.pixel, fontSize: 8, color: "#FFFFFF" },
  body: { backgroundColor: dex.screen, borderRadius: radius.sm, borderWidth: 2, borderColor: dex.screenBorder, padding: spacing.md, marginTop: spacing.sm },
  species: { fontFamily: fonts.pixel, fontSize: 14, lineHeight: 20, color: dex.screenText },
  measures: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  measure: { fontFamily: fonts.pixelBody, fontSize: 28, color: dex.screenText },
  meta: { fontFamily: fonts.pixelBody, fontSize: 19, color: dex.screenMuted },
  footer: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.sm },
  brand: { fontFamily: fonts.pixel, fontSize: 12, color: "#FFFFFF" },
  brandSub: { fontFamily: fonts.pixelBody, fontSize: 18, color: "rgba(255,255,255,0.75)" },
  button: { marginTop: spacing.lg, alignSelf: "stretch" },
});
