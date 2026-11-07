import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

export function EmptyState({
  icon = "hook",
  title,
  description,
}: {
  icon?: IconName;
  title: string;
  description?: string;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={24} color={colors.textPrimary} />
      </View>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
    iconBox: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      borderWidth: BORDER,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    title: { ...typography.sectionTitle, fontSize: 10, color: c.textPrimary, textAlign: "center" },
    description: { ...typography.body, color: c.textSecondary, textAlign: "center", marginTop: spacing.sm },
  });
