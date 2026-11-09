import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { deleteAccount } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { dropQueuedCapturesOf } from "@/services/syncQueue";
import { Alert } from "@/utils/alert";

const WHAT_IS_DELETED = [
  "Todas tus capturas y sus fotos",
  "Tu FishDex, ELO, logros e insignias",
  "Amigos, solicitudes, retos que creaste y comentarios",
  "Tus spots guardados y su clima",
];

/** Borrar cuenta (obligatorio en Google Play y App Store). Es definitivo. */
export default function DeleteAccountScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirm = () =>
    Alert.alert("¿Borrar tu cuenta?", "Esto no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar para siempre", style: "destructive", onPress: doDelete },
    ]);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(password);
      if (user) await dropQueuedCapturesOf(user.id).catch(() => undefined);
      await logout({ revokeOnServer: false }).catch(() => undefined);
      router.replace("/");
    } catch (err) {
      Alert.alert("No se ha podido borrar", extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DexScreen title="Borrar cuenta" counter="Zona peligrosa" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.warning}>
          <Icon name="alert" size={28} color={colors.danger} />
          <Text style={styles.warningTitle}>Se borrará todo, para siempre</Text>
          {WHAT_IS_DELETED.map((item) => (
            <View key={item} style={styles.item}>
              <Icon name="trash" size={14} color={colors.danger} />
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.note}>Las especies que añadiste al catálogo común se quedan, sin tu nombre.</Text>
        </Card>
        <Card>
          <TextField label="Confirma con tu contraseña" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        </Card>
        <PrimaryButton label="Borrar mi cuenta" icon="trash" variant="danger" onPress={confirm} loading={deleting} disabled={!password} />
      </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    warning: { gap: spacing.sm, borderColor: c.danger },
    warningTitle: { ...typography.sectionTitle, color: c.danger },
    item: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    itemText: { ...typography.body, color: c.textPrimary, flex: 1 },
    note: { ...typography.captionSmall, color: c.textMuted, marginTop: spacing.xs },
  });
