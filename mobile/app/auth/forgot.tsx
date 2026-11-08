import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { requestPasswordReset, resetPassword } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";

/** Recuperar contraseña en dos pasos: 1) email -> te enviamos un código de
 * 6 cifras; 2) código + contraseña nueva -> entras directamente. */
export default function ForgotPasswordScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const params = useLocalSearchParams<{ email?: string; step?: string }>();
  const [step, setStep] = useState<"email" | "code">(params.step === "code" ? "code" : "email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setError(null);
    if (!email.includes("@")) return setError("Escribe el email de tu cuenta.");
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setStep("code");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError("El código tiene 6 cifras.");
    if (password.length < 8) return setError("La contraseña nueva debe tener al menos 8 caracteres.");
    setLoading(true);
    try {
      setUser(await resetPassword(email.trim().toLowerCase(), code.trim(), password));
      router.replace("/(tabs)/home");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DexScreen title="Recuperar" counter={step === "email" ? "Paso 1/2 · Email" : "Paso 2/2 · Código"} onBack={() => (step === "code" ? setStep("email") : router.back())}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Icon name={step === "email" ? "lock" : "inbox"} size={22} color={colors.textPrimary} />
            <Text style={styles.dialogText}>
              {step === "email"
                ? "¿Se te ha escapado la contraseña? Te mandamos un código de 6 cifras a tu email."
                : `Si ${email.trim()} tiene cuenta, te hemos enviado un código. Caduca en 15 minutos.`}
            </Text>
          </View>

          {step === "email" ? (
            <>
              <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="tucorreo@ejemplo.com" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Enviar código" onPress={sendCode} loading={loading} />
            </>
          ) : (
            <>
              <TextField label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456" style={styles.code} />
              <TextField label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry placeholder="Mínimo 8 caracteres" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Cambiar y entrar" onPress={reset} loading={loading} />
              <PrimaryButton label="Reenviar código" variant="secondary" onPress={sendCode} disabled={loading} style={{ marginTop: spacing.sm }} />
            </>
          )}
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
    code: { letterSpacing: 8, fontSize: 30 },
    error: { ...typography.body, color: c.danger, textAlign: "center", marginBottom: spacing.sm },
  });
