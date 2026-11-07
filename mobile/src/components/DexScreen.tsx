import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/components/Icon";
import { BORDER, dex, fonts, radius, spacing, ThemeColors } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

interface Props {
  /** Título pixelado de la carcasa (se muestra en mayúsculas). */
  title: string;
  /** Línea pequeña bajo el título (contador, número de Dex...). */
  counter?: string;
  onBack?: () => void;
  /** Botón de acción a la derecha. */
  action?: { icon: IconName; onPress: () => void; label?: string };
  /** Contenido libre a la derecha (varios botones, avatar...). */
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Estilo del área LCD (p.ej. `padding: 0` para mapas a sangre). */
  screenStyle?: ViewStyle;
  /** Sin tope de área segura arriba (pantallas dentro de un modal). */
  withInset?: boolean;
}

/** Toda pantalla de FishDex es el "aparato": carcasa con lente y LEDs y el
 * contenido dentro de una pantalla LCD enmarcada. Usar como contenedor raíz
 * de cada pantalla; los hijos (ScrollView, FlatList...) llenan la LCD. */
export function DexScreen({ title, counter, onBack, action, right, children, screenStyle, withInset = true }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, withInset && { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        {onBack ? (
          <ShellButton icon="arrow-left" label="Volver" onPress={onBack} />
        ) : (
          <View style={styles.lensRing}>
            <View style={styles.lens}>
              <View style={styles.lensGlint} />
            </View>
          </View>
        )}
        <View style={styles.leds}>
          <View style={[styles.led, { backgroundColor: dex.ledRed }]} />
          <View style={[styles.led, { backgroundColor: dex.ledYellow }]} />
          <View style={[styles.led, { backgroundColor: dex.ledGreen }]} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {title.toUpperCase()}
          </Text>
          {counter ? (
            <Text style={styles.counter} numberOfLines={1}>
              {counter.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {right}
        {action ? <ShellButton icon={action.icon} label={action.label ?? action.icon} onPress={action.onPress} /> : null}
      </View>
      <View style={styles.hinge} />
      <View style={styles.bezel}>
        <View style={styles.bezelDots}>
          <View style={styles.bezelDot} />
          <View style={styles.bezelDot} />
        </View>
        <View style={[styles.screen, { backgroundColor: colors.background }, screenStyle]}>{children}</View>
      </View>
    </View>
  );
}

/** Botón cuadrado de la carcasa (volver, ajustes, añadir...). */
export function ShellButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.shellButton, pressed && styles.shellButtonPressed]}
    >
      <Icon name={icon} size={18} color={colors.shellText} />
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    shell: { flex: 1, backgroundColor: c.shell, paddingHorizontal: spacing.sm + 2, paddingBottom: spacing.sm },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 2, marginBottom: spacing.sm },
    lensRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: dex.lensRing,
      borderWidth: BORDER,
      borderColor: c.shellDark,
      alignItems: "center",
      justifyContent: "center",
    },
    lens: { width: 28, height: 28, borderRadius: 14, backgroundColor: dex.lens, borderWidth: BORDER, borderColor: c.shellDark },
    lensGlint: { position: "absolute", top: 4, left: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.8)" },
    leds: { flexDirection: "row", gap: 5, alignSelf: "flex-start", marginTop: 2 },
    led: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: c.shellDark },
    titleBlock: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
    title: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: c.shellText, letterSpacing: 1 },
    counter: { fontFamily: fonts.pixel, fontSize: 8, lineHeight: 12, color: c.shellTextMuted, marginTop: 4 },
    shellButton: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: c.shellLight,
      borderWidth: BORDER,
      borderColor: c.shellDark,
      borderBottomWidth: BORDER + 2,
      alignItems: "center",
      justifyContent: "center",
    },
    shellButtonPressed: { borderBottomWidth: BORDER, transform: [{ translateY: 2 }] },
    hinge: { height: 4, borderRadius: 2, backgroundColor: c.shellDark, marginBottom: spacing.sm, opacity: 0.7 },
    bezel: {
      flex: 1,
      backgroundColor: c.bezel,
      borderRadius: radius.lg,
      borderBottomRightRadius: 28,
      padding: spacing.xs + 2,
      paddingTop: spacing.md - 2,
    },
    bezelDots: { position: "absolute", top: 4, alignSelf: "center", flexDirection: "row", gap: 10 },
    bezelDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: dex.ledRed },
    screen: {
      flex: 1,
      borderRadius: radius.sm,
      borderWidth: BORDER,
      borderColor: c.border,
      overflow: "hidden",
    },
  });
