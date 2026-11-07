import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";

import { BORDER, fonts, radius } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { mediaUrl } from "@/services/api";

interface Props {
  /** Ruta o URL del avatar; si falta se muestran las iniciales. */
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Marco más grueso (avatar grande de perfil). */
  ring?: boolean;
  style?: ViewStyle;
}

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Avatar tipo "sprite": casilla con borde de tinta e iniciales pixeladas. */
export function Avatar({ uri, name, size = 40, ring = false, style }: Props) {
  const { colors } = useTheme();
  const resolved = mediaUrl(uri);
  const box = { width: size, height: size, borderRadius: size >= 64 ? radius.lg : radius.md };

  return (
    <View
      style={[
        styles.container,
        box,
        { backgroundColor: colors.primary, borderColor: colors.border, borderWidth: ring ? BORDER + 1 : BORDER },
        style,
      ]}
    >
      {resolved ? (
        <Image source={{ uri: resolved }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.26), color: colors.onPrimary }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { fontFamily: fonts.pixel },
});
