import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";

import { BORDER, radius, spacing, ThemeColors } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Sin padding interior (para fotos a sangre). */
  flush?: boolean;
}

/** Recuadro de la pantalla LCD: borde grueso de tinta y "relieve" pixel. */
export function Card({ children, onPress, style, flush = false }: Props) {
  const styles = useStyles(makeStyles);
  const content = <View style={[styles.card, !flush && styles.padded, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      {content}
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: BORDER,
      borderBottomWidth: BORDER + 2,
      borderColor: c.border,
      overflow: "hidden",
    },
    padded: { padding: spacing.md - 4 },
    pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },
  });
