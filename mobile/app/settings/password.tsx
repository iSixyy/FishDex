import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles } from "@/context/ThemeContext";
import { changePassword } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { Alert } from "@/utils/alert";

/** Cambiar contraseña. Cierra la sesión en los demás dispositivos. */
export default function ChangePasswordScreen() {
  const styles = useStyles(makeStyles);
  const { setUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);

  const error =
    next && next.length < 8 ? "Mínimo 8 caracteres." : repeat && next !== repeat ? "Las contraseñas no coinciden." : null;

  const save = async () => {
    if (!current || !next || error || next !== repeat) return;
    setSaving(true);
    try {
      setUser(await changePassword(current, next));
      Alert.alert("Contraseña cambiada", "Se ha cerrado la sesión en tus otros dispositivos.");
      router.back();
    } catch (err) {
      Alert.alert("No se ha podido cambiar", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DexScreen title="Contraseña" counter="Cambiar contraseña" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <TextField label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" />
          <TextField label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry placeholder="Mínimo 8 caracteres" />
          <TextField label="Repite la nueva" value={repeat} onChangeText={setRepeat} secureTextEntry placeholder="••••••••" error={error ?? undefined} />
          <Text style={styles.hint}>Por seguridad, se cerrará la sesión en tus otros móviles.</Text>
        </Card>
        <PrimaryButton label="Cambiar contraseña" onPress={save} loading={saving} disabled={!current || !next || !!error || next !== repeat} />
      </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    hint: { ...typography.captionSmall, color: c.textMuted },
  });
