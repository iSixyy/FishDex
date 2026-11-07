import React from "react";
import { View } from "react-native";

import { useTheme } from "@/context/ThemeContext";

/** Barra de progreso de consola: marco de tinta y relleno macizo. */
export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 12,
}: {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const clamped = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  return (
    <View
      style={{
        height,
        borderRadius: 2,
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: trackColor ?? colors.surface,
        overflow: "hidden",
        padding: 1,
      }}
    >
      <View style={{ width: `${clamped * 100}%`, height: "100%", backgroundColor: color ?? colors.primary }} />
    </View>
  );
}
