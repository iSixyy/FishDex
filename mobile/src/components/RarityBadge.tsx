import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { fonts, radius, spacing } from "@/constants/theme";
import { useGameConfig } from "@/context/GameConfigContext";
import { useTheme } from "@/context/ThemeContext";
import { Rarity } from "@/types";

/** Etiqueta de rareza en tipografía pixelada (estética de la Dex). */
export function RarityBadge({
  rarity,
  size = "md",
  onPhoto = false,
  style,
}: {
  rarity: Rarity | string;
  size?: "sm" | "md";
  onPhoto?: boolean;
  style?: ViewStyle;
}) {
  const { rarityColor, rarityLabel } = useGameConfig();
  const color = rarityColor(rarity);

  return (
    <View
      style={[
        styles.badge,
        size === "sm" && styles.badgeSm,
        onPhoto ? styles.onPhoto : { backgroundColor: `${color}22`, borderColor: `${color}66` },
        style,
      ]}
    >
      <View style={[styles.dot, size === "sm" && styles.dotSm, { backgroundColor: color }]} />
      <Text style={[styles.text, size === "sm" && styles.textSm, { color: onPhoto ? "#111113" : color }]}>
        {rarityLabel(rarity).toUpperCase()}
      </Text>
    </View>
  );
}

export function RarityDot({ rarity, size = 10 }: { rarity: Rarity | string; size?: number }) {
  const { rarityColor } = useGameConfig();
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: rarityColor(rarity),
        borderWidth: 1.5,
        borderColor: colors.surface,
      }}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeSm: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  onPhoto: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "transparent" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSm: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.pixel, fontSize: 8, lineHeight: 11 },
  textSm: { fontSize: 7, lineHeight: 10 },
});
