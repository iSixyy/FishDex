import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

/** Panel "invertido" de la pantalla LCD (fondo de tinta, texto claro): el
 * mensaje principal de una pantalla con su botón de acción. */
export function HeroCard({
  eyebrow,
  title,
  actionLabel,
  onAction,
  children,
  style,
}: {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={[colors.heroStart, colors.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Líneas de barrido de pantalla antigua. */}
      <View style={styles.scanlines} pointerEvents="none">
        {Array.from({ length: 18 }).map((_, i) => (
          <View key={i} style={styles.scanline} />
        ))}
      </View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {children}
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} compact onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.md,
      borderWidth: BORDER,
      borderBottomWidth: BORDER + 2,
      borderColor: c.border,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      alignItems: "center",
      minHeight: 200,
      justifyContent: "center",
    },
    scanlines: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", opacity: 0.08 },
    scanline: { height: 2, backgroundColor: c.heroText },
    eyebrow: { ...typography.body, color: c.heroTextMuted, textAlign: "center" },
    title: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.heroText, textAlign: "center", marginTop: spacing.sm },
    button: { marginTop: spacing.lg },
  });
