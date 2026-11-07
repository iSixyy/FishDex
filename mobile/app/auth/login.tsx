import { router } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";

export default function LoginScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Introduce tu email y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DexScreen
      title="Continuar"
      counter="Iniciar sesión"
      onBack={router.canGoBack() ? () => router.back() : undefined}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Icon name="hook" size={22} color={colors.textPrimary} />
            <Text style={styles.dialogText}>¡Hola de nuevo, pescador! Carga tu partida para seguir completando la FishDex.</Text>
          </View>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tucorreo@ejemplo.com"
          />
          <TextField label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label="Entrar" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.xs }} />

          <Pressable onPress={() => router.push("/auth/register")} style={styles.link} accessibilityRole="link">
            <Text style={styles.linkText}>¿No tienes partida guardada?</Text>
            <Text style={styles.linkStrong}>▶ NUEVA PARTIDA</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.md },
    dialog: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
      backgroundColor: c.surface,
      borderWidth: BORDER,
      borderBottomWidth: BORDER + 2,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md - 4,
      marginBottom: spacing.lg,
    },
    dialogText: { ...typography.body, fontSize: 21, color: c.textPrimary, flex: 1 },
    error: { ...typography.body, color: c.danger, textAlign: "center", marginBottom: spacing.sm },
    link: { alignItems: "center", marginTop: spacing.lg, gap: 6 },
    linkText: { ...typography.body, color: c.textSecondary },
    linkStrong: { ...typography.button, color: c.textPrimary },
  });
