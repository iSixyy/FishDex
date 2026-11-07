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

export default function RegisterScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!displayName || !username || !email || !password) return "Rellena todos los campos.";
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      return "El usuario debe tener entre 3 y 30 caracteres (letras, números, _ o .).";
    }
    if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    return null;
  };

  const handleRegister = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
      });
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DexScreen
      title="Nueva partida"
      counter="Crear cuenta"
      onBack={router.canGoBack() ? () => router.back() : undefined}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Icon name="fish" size={22} color={colors.textPrimary} />
            <Text style={styles.dialogText}>¡Bienvenido al mundo de la pesca! Antes de empezar, dime cómo te llamas.</Text>
          </View>

          <TextField label="Nombre" value={displayName} onChangeText={setDisplayName} placeholder="Cómo te llamas" />
          <TextField label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="usuario_unico" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tucorreo@ejemplo.com"
          />
          <TextField label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8 caracteres" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label="Empezar aventura" onPress={handleRegister} loading={loading} style={{ marginTop: spacing.xs }} />

          <Pressable onPress={() => router.push("/auth/login")} style={styles.link} accessibilityRole="link">
            <Text style={styles.linkText}>¿Ya tienes partida guardada?</Text>
            <Text style={styles.linkStrong}>▶ CONTINUAR</Text>
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
