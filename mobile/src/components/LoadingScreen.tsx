import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";

/** Pantalla de carga de consola: texto pixelado con puntos que avanzan. */
export function LoadingScreen({ message = "Cargando" }: { message?: string }) {
  const styles = useStyles(makeStyles);
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setDots((d) => (d + 1) % 4), 350);
    return () => clearInterval(timer);
  }, []);
  const base = message.replace(/\.+$/, "").toUpperCase();
  return (
    <View style={styles.container}>
      <View style={styles.blocks}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.block, i < dots && styles.blockOn]} />
        ))}
      </View>
      <Text style={styles.message}>
        {base}
        {".".repeat(dots)}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background, padding: spacing.lg },
    blocks: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
    block: { width: 14, height: 14, borderWidth: 2, borderColor: c.border },
    blockOn: { backgroundColor: c.primary },
    message: { ...typography.overline, color: c.textPrimary, textAlign: "center" },
  });
