import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";

import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Se conservan por compatibilidad: ambos se pintan como botones de consola. */
  variant?: "pill" | "underline";
  scrollable?: boolean;
  style?: ViewStyle;
}

/** Selector de opciones con estética de consola: casillas con borde de
 * tinta; la activa va "invertida" (tinta de fondo, texto de LCD). */
export function SegmentedTabs<T extends string>({ options, value, onChange, scrollable = false, style }: Props<T>) {
  const styles = useStyles(makeStyles);
  const content = options.map((option) => {
    const active = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [styles.tab, !scrollable && styles.tabFlex, active && styles.tabActive, pressed && styles.pressed]}
      >
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit>
          {option.label.toUpperCase()}
        </Text>
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]}>
        {content}
      </ScrollView>
    );
  }
  return <View style={[styles.row, style]}>{content}</View>;
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.xs },
    tab: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs + 2,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tabFlex: { flex: 1 },
    tabActive: { backgroundColor: c.primary },
    label: { ...typography.button, fontSize: 8, color: c.textPrimary },
    labelActive: { color: c.onPrimary },
    pressed: { opacity: 0.7 },
  });
