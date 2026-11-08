import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { BORDER, fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { BiteForecast } from "@/types";

const SEGMENTS = 10;

/** Previsión de picada: barra pixelada de 10 tramos, nota y los factores
 * que suman o restan, para que se entienda POR QUÉ es buen o mal día. */
export function ForecastCard({ forecast, title = "Previsión de picada" }: { forecast: BiteForecast; title?: string }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const tone =
    forecast.score >= 75 ? colors.success : forecast.score >= 60 ? colors.accent : forecast.score >= 40 ? colors.warning : colors.danger;
  const filled = Math.round((forecast.score / 100) * SEGMENTS);

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Icon name="hook" size={16} color={colors.textMuted} />
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: tone }]}>{forecast.score}</Text>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.label, { color: tone }]}>{forecast.label.toUpperCase()}</Text>
          <View style={styles.bar}>
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <View key={i} style={[styles.segment, { backgroundColor: i < filled ? tone : "transparent" }]} />
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.summary}>{forecast.summary}</Text>
      <View style={styles.factors}>
        {forecast.factors.map((factor) => (
          <View key={factor.label} style={styles.factor}>
            <Text
              style={[
                styles.points,
                { color: factor.points > 0 ? colors.success : factor.points < 0 ? colors.danger : colors.textMuted },
              ]}
            >
              {factor.points > 0 ? `+${factor.points}` : factor.points === 0 ? "·" : factor.points}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.factorLabel}>{factor.label}</Text>
              <Text style={styles.factorDetail}>{factor.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      {forecast.partial ? (
        <Text style={styles.partial}>Sin datos de clima ahora mismo: se calcula solo con la hora y la luna.</Text>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    title: { ...typography.sectionTitle, color: c.textPrimary },
    scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    score: { fontFamily: fonts.pixel, fontSize: 30, lineHeight: 40 },
    label: { ...typography.pixelSmall },
    bar: {
      flexDirection: "row",
      gap: 3,
      padding: 3,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.xs,
      backgroundColor: c.background,
    },
    segment: { flex: 1, height: 12 },
    summary: { ...typography.body, color: c.textPrimary, marginTop: spacing.sm },
    factors: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: spacing.xs + 2,
    },
    factor: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    points: { fontFamily: fonts.pixel, fontSize: 10, width: 34, textAlign: "right", marginTop: 3 },
    factorLabel: { ...typography.captionSmall, color: c.textMuted },
    factorDetail: { ...typography.caption, color: c.textPrimary },
    partial: { ...typography.captionSmall, color: c.textMuted, marginTop: spacing.sm },
  });
