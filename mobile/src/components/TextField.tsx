import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  /** Contenido a la derecha dentro del campo (icono de reloj, calendario...). */
  adornment?: React.ReactNode;
  /** Resalta el campo como rellenado por la IA (el usuario puede cambiarlo). */
  aiFilled?: boolean;
  containerStyle?: ViewStyle;
}

/** Campo de texto de consola: rótulo pixelado y caja con borde de tinta. */
export function TextField({ label, error, adornment, aiFilled, style, containerStyle, ...inputProps }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label.toUpperCase()}
          {aiFilled ? <Text style={styles.aiTag}>  · IA</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.inputWrapper, aiFilled && styles.inputAi, !!error && styles.inputError]}>
        <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...inputProps} />
        {adornment ? <View style={styles.adornment}>{adornment}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { marginBottom: spacing.md - 2 },
    label: { ...typography.overline, fontSize: 8, color: c.textSecondary, marginBottom: 6 },
    aiTag: { color: c.accent },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm + 2,
    },
    inputAi: { borderColor: c.accent, backgroundColor: c.accentSoft },
    inputError: { borderColor: c.danger },
    input: { ...typography.body, fontSize: 22, flex: 1, color: c.textPrimary, paddingVertical: 8 },
    adornment: { marginLeft: spacing.sm },
    error: { ...typography.caption, color: c.danger, marginTop: spacing.xs },
  });
