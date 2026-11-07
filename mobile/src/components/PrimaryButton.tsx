import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

type Variant = "primary" | "secondary" | "light" | "danger";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Icono opcional a la izquierda del texto. */
  icon?: IconName;
  /** Botón compacto y centrado. */
  compact?: boolean;
  style?: ViewStyle;
}

/** Botón de consola con relieve pixel (se "hunde" al pulsarlo).
 *  - `primary`: el botón rojo de la Pokédex.
 *  - `secondary`: contorno de tinta sobre la LCD.
 *  - `light`: relleno LCD, para paneles invertidos o fotos.
 *  - `danger`: acciones destructivas. */
export function PrimaryButton({ label, onPress, variant = "primary", disabled, loading, icon, compact, style }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const labelColor: Record<Variant, string> = {
    primary: colors.onCta,
    secondary: colors.textPrimary,
    light: colors.textPrimary,
    danger: "#FFFFFF",
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={16} color={labelColor[variant]} /> : null}
          <Text style={[styles.label, { color: labelColor[variant] } as TextStyle]} numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: {
      height: 52,
      borderRadius: radius.md,
      borderWidth: BORDER,
      borderBottomWidth: BORDER + 3,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    compact: { height: 44, alignSelf: "center", paddingHorizontal: spacing.lg },
    primary: { backgroundColor: c.cta, borderColor: c.ctaDark },
    secondary: { backgroundColor: c.surface, borderColor: c.border },
    light: { backgroundColor: c.background, borderColor: c.border },
    danger: { backgroundColor: c.danger, borderColor: c.border },
    pressed: { borderBottomWidth: BORDER, transform: [{ translateY: 3 }] },
    disabled: { opacity: 0.45 },
    content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    label: { ...typography.button },
  });
