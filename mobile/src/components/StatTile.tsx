import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Card } from "@/components/Card";
import { Icon, IconName } from "@/components/Icon";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

interface Props {
  label: string;
  value: string;
  icon?: IconName;
  delta?: string | null;
  style?: ViewStyle;
}

export function StatTile({ label, value, icon, delta, style }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const positive = !!delta && !delta.trim().startsWith("-");
  return (
    <Card style={StyleSheet.flatten([styles.tile, style])}>
      <View style={styles.header}>
        {icon ? <Icon name={icon} size={14} color={colors.textSecondary} /> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {delta ? (
        <View style={styles.deltaRow}>
          <Icon
            name={positive ? "arrow-up" : "arrow-down"}
            size={12}
            color={positive ? colors.success : colors.danger}
            strokeWidth={2.2}
          />
          <Text style={[styles.delta, { color: positive ? colors.success : colors.danger }]}>
            {delta.replace(/^[+-]/, "")}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    tile: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    label: { ...typography.caption, color: c.textSecondary },
    value: { ...typography.stat, color: c.textPrimary, marginTop: spacing.sm },
    deltaRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
    delta: { ...typography.caption },
  });
