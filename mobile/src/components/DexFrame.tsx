import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { dex, fonts, radius, spacing } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

/** Carcasa del "dispositivo" FishDex, inspirada en la Pokédex pero marina:
 * cuerpo azul océano, lente grande tipo ojo de buey, tres LEDs y una
 * pantalla LCD con marco. `children` se pinta dentro de la pantalla. */
export function DexFrame({
  children,
  title = "FISHDEX",
  counter,
  style,
  screenStyle,
  fill = false,
}: {
  children: React.ReactNode;
  title?: string;
  /** Texto a la derecha de la cabecera (p.ej. "012/017"). */
  counter?: string;
  style?: ViewStyle;
  screenStyle?: ViewStyle;
  /** Ocupa todo el alto disponible (la pantalla LCD crece con él). */
  fill?: boolean;
}) {
  return (
    <View style={[styles.shell, fill && styles.fill, style]}>
      <View style={styles.top}>
        <View style={styles.lensRing}>
          <View style={styles.lens}>
            <View style={styles.lensGlint} />
          </View>
        </View>
        <View style={styles.leds}>
          <View style={[styles.led, { backgroundColor: dex.ledRed }]} />
          <View style={[styles.led, { backgroundColor: dex.ledYellow }]} />
          <View style={[styles.led, { backgroundColor: dex.ledGreen }]} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {counter ? <Text style={styles.counter}>{counter}</Text> : null}
        </View>
      </View>
      <View style={styles.hinge} />
      <View style={[styles.screenBezel, fill && styles.fill]}>
        <View style={styles.bezelDots}>
          <View style={styles.bezelDot} />
          <View style={styles.bezelDot} />
        </View>
        <View style={[styles.screen, fill && styles.fill, screenStyle]}>{children}</View>
      </View>
    </View>
  );
}

/** Texto pixelado para la pantalla LCD (colores del tema activo). */
export function DexText({
  children,
  size = "body",
  muted = false,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: "title" | "small" | "body";
  muted?: boolean;
  style?: object;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        size === "title" ? styles.textTitle : size === "small" ? styles.textSmall : styles.textBody,
        { color: muted ? colors.textMuted : colors.textPrimary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shell: {
    backgroundColor: dex.shell,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 3,
    borderColor: dex.shellDark,
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  lensRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: dex.lensRing,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: dex.shellDark,
  },
  lens: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: dex.lens,
    borderWidth: 2,
    borderColor: dex.shellDark,
  },
  lensGlint: { position: "absolute", top: 6, left: 7, width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.75)" },
  leds: { flexDirection: "row", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  led: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: dex.shellDark },
  titleWrap: { flex: 1, alignItems: "flex-end" },
  title: { fontFamily: fonts.pixel, fontSize: 12, color: "#FFFFFF", letterSpacing: 1 },
  counter: { fontFamily: fonts.pixel, fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 6 },
  hinge: { height: 4, borderRadius: 2, backgroundColor: dex.hinge, marginBottom: spacing.sm, opacity: 0.6 },
  screenBezel: {
    backgroundColor: "#E8EEF3",
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingTop: spacing.md,
    borderBottomRightRadius: 34,
  },
  bezelDots: { position: "absolute", top: 5, alignSelf: "center", flexDirection: "row", gap: 10 },
  bezelDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: dex.ledRed },
  screen: {
    backgroundColor: dex.screen,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: dex.screenBorder,
    padding: spacing.sm,
    overflow: "hidden",
  },
  textTitle: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 18 },
  textSmall: { fontFamily: fonts.pixel, fontSize: 8, lineHeight: 12 },
  textBody: { fontFamily: fonts.pixelBody, fontSize: 20, lineHeight: 21 },
});
