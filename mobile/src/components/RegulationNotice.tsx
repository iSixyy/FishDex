import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { RegulationCheck } from "@/types";

/** Avisos legales (veda, talla mínima, cupo) antes de guardar una captura.
 * Nunca se inventa un dato: sin normativa cargada se dice explícitamente. */
export function RegulationNotice({ check }: { check: RegulationCheck }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  if (!check.has_data) {
    return (
      <View style={[styles.box, styles.info]}>
        <Icon name="info" size={16} color={colors.textSecondary} />
        <Text style={styles.text}>
          No tenemos normativa verificada para esta especie{check.autonomous_community ? ` en ${check.autonomous_community}` : ""}.
          Consulta la de tu comunidad antes de quedártela.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {check.warnings.map((warning, index) => (
        <View key={`${warning.kind}-${index}`} style={[styles.box, warning.severity === "danger" ? styles.danger : styles.info]}>
          <Icon
            name={warning.severity === "danger" ? "alert" : "info"}
            size={16}
            color={warning.severity === "danger" ? colors.danger : colors.textSecondary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, warning.severity === "danger" && { color: colors.danger }]}>{warning.message}</Text>
            {warning.source ? <Text style={styles.source}>Fuente: {warning.source}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
    info: { backgroundColor: c.surfaceAlt, borderColor: c.border },
    danger: { backgroundColor: `${c.danger}14`, borderColor: `${c.danger}55` },
    text: { ...typography.body, fontSize: 14, color: c.textPrimary, flex: 1 },
    source: { ...typography.captionSmall, color: c.textMuted, marginTop: 2 },
  });
