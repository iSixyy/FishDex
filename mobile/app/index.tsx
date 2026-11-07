import { Redirect, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SpainFlag } from "@/components/SpainFlag";
import { BORDER, fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";

/** Pantalla de inicio: el aparato "encendiéndose", como la portada de un
 * juego de consola, con las dos opciones de siempre. */
export default function Index() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user, isLoading } = useAuth();
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setBlink((b) => !b), 600);
    return () => clearInterval(timer);
  }, []);

  if (isLoading) return <DexScreen title="FishDex"><LoadingScreen message="Encendiendo" /></DexScreen>;
  if (user) return <Redirect href="/(tabs)/home" />;

  return (
    <DexScreen title="FishDex">
      <View style={styles.screen}>
        <View style={styles.logoBlock}>
          <View style={styles.fishBox}>
            <Icon name="fish" size={64} color={colors.textPrimary} strokeWidth={2.4} />
          </View>
          <Text style={styles.logo}>FISHDEX</Text>
          <Text style={styles.tagline}>Más que pesca,{"\n"}una colección de historias.</Text>
          <Text style={[styles.pressStart, { opacity: blink ? 1 : 0 }]}>▶ ELIGE UNA OPCIÓN</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Nueva partida" icon="plus" onPress={() => router.push("/auth/register")} />
          <PrimaryButton label="Continuar" icon="arrow-left" variant="secondary" onPress={() => router.push("/auth/login")} />
          <Text style={styles.actionHint}>Nueva partida = crear cuenta · Continuar = iniciar sesión</Text>
        </View>

        <View style={styles.footer}>
          <SpainFlag width={18} />
          <Text style={styles.footerText}>HECHO PARA PESCADORES DE ESPAÑA</Text>
        </View>
      </View>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, padding: spacing.md, justifyContent: "space-between" },
    logoBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
    fishBox: {
      width: 120,
      height: 120,
      borderRadius: radius.lg,
      borderWidth: BORDER + 1,
      borderBottomWidth: BORDER + 4,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    logo: { fontFamily: fonts.pixel, fontSize: 30, lineHeight: 40, color: c.textPrimary, letterSpacing: 2 },
    tagline: { ...typography.body, fontSize: 24, lineHeight: 26, color: c.textSecondary, textAlign: "center" },
    pressStart: { ...typography.overline, color: c.textPrimary, marginTop: spacing.sm },
    actions: { gap: spacing.sm },
    actionHint: { ...typography.caption, color: c.textMuted, textAlign: "center" },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
    footerText: { fontFamily: fonts.pixel, fontSize: 7, color: c.textMuted },
  });
