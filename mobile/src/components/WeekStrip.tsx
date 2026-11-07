import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BORDER, fonts, radius, spacing, ThemeColors } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";

const DAY_LABELS = ["DO", "LU", "MA", "MI", "JU", "VI", "SÁ"];

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Semana actual (domingo a sábado). Los días con capturas llevan un
 * bloque debajo; el seleccionado va invertido. */
export function WeekStrip({
  selected,
  onSelect,
  markedDays,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
  /** Claves `dayKey` de los días con alguna captura. */
  markedDays: Set<string>;
}) {
  const styles = useStyles(makeStyles);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

  return (
    <View style={styles.row}>
      {days.map((day) => {
        const isSelected = dayKey(day) === dayKey(selected);
        const isFuture = day > today;
        return (
          <Pressable
            key={dayKey(day)}
            disabled={isFuture}
            onPress={() => onSelect(day)}
            style={[styles.day, isSelected && styles.daySelected, isFuture && styles.future]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.label, isSelected && styles.textSelected]}>{DAY_LABELS[day.getDay()]}</Text>
            <Text style={[styles.number, isSelected && styles.textSelected]}>{day.getDate()}</Text>
            <View style={[styles.mark, markedDays.has(dayKey(day)) && (isSelected ? styles.markOnSelected : styles.markOn)]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
    day: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    daySelected: { backgroundColor: c.primary },
    label: { fontFamily: fonts.pixel, fontSize: 6, color: c.textMuted },
    number: { fontFamily: fonts.pixelBody, fontSize: 22, lineHeight: 24, color: c.textPrimary, marginTop: 2 },
    textSelected: { color: c.onPrimary },
    future: { opacity: 0.4 },
    mark: { width: 8, height: 4, marginTop: 2 },
    markOn: { backgroundColor: c.cta },
    markOnSelected: { backgroundColor: c.onPrimary },
  });
