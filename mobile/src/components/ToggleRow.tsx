import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  icon?: IconName;
}

/** Interruptor de consola: casilla pixelada con check, todo el renglón pulsable. */
export function ToggleRow({ label, description, value, onChange, icon }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.row, value && styles.rowOn]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      {icon ? <Icon name={icon} size={20} color={value ? colors.success : colors.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={[styles.box, value && styles.boxOn]}>
        {value ? <Icon name="check" size={16} color={colors.onCta} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      padding: spacing.sm + 2,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      backgroundColor: c.surface,
      marginBottom: spacing.md - 2,
    },
    rowOn: { backgroundColor: c.accentSoft },
    label: { ...typography.bodyMedium, color: c.textPrimary },
    description: { ...typography.captionSmall, color: c.textSecondary },
    box: {
      width: 26,
      height: 26,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.xs,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    boxOn: { backgroundColor: c.success, borderColor: c.success },
  });
