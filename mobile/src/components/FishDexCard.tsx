import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { BORDER, fonts, radius, spacing, ThemeColors } from "@/constants/theme";
import { useGameConfig } from "@/context/GameConfigContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { mediaUrl } from "@/services/api";
import { FishSpeciesSummary } from "@/types";

const WATER_LABEL: Record<string, string> = { FRESH: "DULCE", SALT: "SALADA", BRACKISH: "SALOBRE" };

/** Casilla de la FishDex.
 *
 * Una especie sin descubrir no revela su nombre ni su foto: solo el número
 * de la Dex y una silueta, que es lo que empuja a seguir coleccionando. El
 * "sprite" de una especie descubierta es TU foto más reciente de ella. */
export function FishDexCard({
  species,
  onPress,
  onLongPress,
  favourite = false,
  variant = "grid",
}: {
  species: FishSpeciesSummary;
  onPress: () => void;
  /** Pulsación larga opcional, p. ej. para marcar/desmarcar favorita. */
  onLongPress?: () => void;
  favourite?: boolean;
  variant?: "grid" | "row";
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { rarityColor } = useGameConfig();
  const unlocked = species.unlocked;
  const photo = unlocked ? mediaUrl(species.image_url) : undefined;
  const number = `No.${String(species.dex_number).padStart(3, "0")}`;
  const accent = unlocked && species.rarity ? rarityColor(species.rarity) : colors.textMuted;

  const sprite = (
    <View style={[variant === "grid" ? styles.sprite : styles.spriteRow, { borderColor: unlocked ? accent : colors.border }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.spriteImage} resizeMode="cover" />
      ) : (
        <Icon
          name="fish"
          size={variant === "grid" ? 30 : 22}
          color={unlocked ? colors.textPrimary : colors.textMuted}
          strokeWidth={1.8}
          filled={!unlocked}
        />
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!unlocked}
      accessibilityRole="button"
      accessibilityLabel={unlocked ? `${species.name}, número ${species.dex_number}` : "Especie sin descubrir"}
      style={({ pressed }) => [variant === "grid" ? styles.card : styles.row, pressed && unlocked && styles.pressed]}
    >
      {variant === "grid" ? (
        <>
          <View style={styles.topRow}>
            <Text style={styles.number}>{number}</Text>
            {favourite ? <Icon name="star" size={10} color={colors.textPrimary} filled /> : null}
          </View>
          {sprite}
          <Text style={[styles.name, !unlocked && styles.locked]} numberOfLines={1}>
            {unlocked ? species.name?.toUpperCase() : "? ? ?"}
          </Text>
          <View style={[styles.rarityBar, { backgroundColor: unlocked ? accent : "transparent" }]} />
        </>
      ) : (
        <>
          {sprite}
          <Text style={styles.rowNumber}>{number}</Text>
          <Text style={[styles.rowName, !unlocked && styles.locked]} numberOfLines={1}>
            {unlocked ? species.name?.toUpperCase() : "- - - - -"}
          </Text>
          {unlocked && species.water_type ? <Text style={styles.type}>{WATER_LABEL[species.water_type]}</Text> : null}
          {favourite ? <Icon name="star" size={12} color={colors.textPrimary} filled /> : null}
          <View style={[styles.caught, { backgroundColor: unlocked ? accent : "transparent" }]} />
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      borderColor: c.border,
      padding: spacing.xs + 2,
      alignItems: "center",
      overflow: "hidden",
    },
    pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    topRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    number: { fontFamily: fonts.pixel, fontSize: 7, color: c.textMuted },
    sprite: {
      width: "100%",
      aspectRatio: 1,
      marginVertical: 6,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    spriteImage: { width: "100%", height: "100%" },
    name: { fontFamily: fonts.pixelBody, fontSize: 17, lineHeight: 18, color: c.textPrimary },
    locked: { color: c.textMuted },
    rarityBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceAlt,
    },
    spriteRow: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    rowNumber: { fontFamily: fonts.pixel, fontSize: 8, color: c.textMuted, width: 58 },
    rowName: { flex: 1, fontFamily: fonts.pixelBody, fontSize: 21, color: c.textPrimary },
    type: {
      fontFamily: fonts.pixel,
      fontSize: 6,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 4,
      paddingVertical: 3,
      borderRadius: 2,
    },
    caught: { width: 12, height: 12, borderRadius: 6, borderWidth: BORDER, borderColor: c.border },
  });
