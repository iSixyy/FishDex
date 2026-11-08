import { router } from "expo-router";
import { DexScreen } from "@/components/DexScreen";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Icon, IconName } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { API_URL } from "@/constants/config";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { ThemePreference, useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { registerForPushNotifications } from "@/services/notificationService";
import { queueLength, trySyncQueue } from "@/services/syncQueue";
import { Alert } from "@/utils/alert";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

export default function SettingsScreen() {
  const styles = useStyles(makeStyles);
  const { preference, setPreference } = useTheme();
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueLength()
      .then((length) => !cancelled && setPending(length))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const report = await trySyncQueue();
      if (report.status === "already_syncing") {
        Alert.alert("Sincronización", "Ya se está sincronizando la cola. Espera a que termine.");
        return;
      }
      setPending(await queueLength());
      const parts: string[] = [];
      if (report.synced > 0) parts.push(`Se han sincronizado ${report.synced} captura(s). El ELO se ha calculado en el servidor.`);
      if (report.discarded > 0) parts.push(`${report.discarded} captura(s) se han descartado porque el servidor las rechazó de forma permanente.`);
      if (parts.length === 0) parts.push("No se ha podido sincronizar ninguna captura pendiente. Comprueba tu conexión.");
      Alert.alert("Sincronización", parts.join("\n\n"));
    } catch (e) {
      Alert.alert("Error de sincronización", extractErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    const ok = await registerForPushNotifications();
    setEnablingPush(false);
    Alert.alert(
      "Notificaciones",
      ok
        ? "Listo: recibirás avisos de solicitudes, retos, récords superados y eventos."
        : "No se han podido activar. Comprueba el permiso de notificaciones en los ajustes del móvil (en emuladores no están disponibles)."
    );
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  return (
    <DexScreen title="Ajustes" counter="Configuración" onBack={() => router.back()}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.cardTitle}>Apariencia</Text>
        <Text style={styles.rowMuted}>El modo oscuro usa azul marino y crema.</Text>
        <SegmentedTabs options={THEME_OPTIONS} value={preference} onChange={setPreference} style={{ marginTop: spacing.md }} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Cuenta</Text>
        <View style={styles.accountHeader}>
          <Avatar uri={user?.avatar} name={user?.display_name} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={styles.row}>{user?.display_name}</Text>
            <Text style={styles.rowMuted}>@{user?.username}</Text>
          </View>
        </View>
        <SettingsLink icon="edit" label="Editar perfil y foto" onPress={() => router.push("/settings/profile")} />
        <SettingsLink icon="lock" label="Cambiar contraseña" onPress={() => router.push("/settings/password")} />
        <SettingsLink icon="flag" label="Licencia de pesca" onPress={() => router.push("/settings/license")} />
        <SettingsLink icon="users" label="Usuarios bloqueados" onPress={() => router.push("/settings/blocked")} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Notificaciones</Text>
        <Text style={styles.rowMuted}>Solicitudes de amistad, retos, récords que te superan y eventos oficiales.</Text>
        <PrimaryButton label="Activar notificaciones" variant="secondary" onPress={handleEnablePush} loading={enablingPush} style={{ marginTop: spacing.md }} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Sincronización offline</Text>
        <Text style={styles.rowMuted}>
          {pending > 0 ? `Tienes ${pending} captura(s) guardadas localmente pendientes de sincronizar.` : "No hay capturas pendientes de sincronizar."}
        </Text>
        <PrimaryButton label="Sincronizar ahora" variant="secondary" onPress={handleSync} loading={syncing} style={{ marginTop: spacing.md }} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Región</Text>
        <Text style={styles.rowMuted}>Idioma: Español (España)</Text>
        <Text style={styles.rowMuted}>Unidades: kg, cm · Fecha: DD/MM/AAAA · Hora: 24h</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Conexión</Text>
        <Text style={styles.rowMuted}>{__DEV__ ? `API: ${API_URL}` : "Conectado al servidor de FishDex"}</Text>
      </Card>

      <PrimaryButton label="Cerrar sesión" variant="danger" onPress={handleLogout} style={{ marginTop: spacing.sm }} />
      <Pressable onPress={() => router.push("/settings/delete-account")} style={styles.deleteLink} accessibilityRole="link">
        <Text style={styles.deleteText}>Borrar mi cuenta</Text>
      </Pressable>
    </ScrollView>
    </DexScreen>
  );
}

function SettingsLink({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Icon name={icon} size={18} color={colors.textPrimary} />
      <Text style={styles.linkText}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    cardTitle: { ...typography.sectionTitle, color: c.textPrimary, marginBottom: spacing.xs },
    row: { ...typography.bodyMedium, color: c.textPrimary },
    rowMuted: { ...typography.body, fontSize: 14, color: c.textSecondary },
    accountHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      paddingVertical: spacing.sm + 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    linkText: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    deleteLink: {
      alignItems: "center",
      padding: spacing.sm,
      borderWidth: BORDER,
      borderStyle: "dashed",
      borderColor: c.danger,
      borderRadius: radius.sm,
    },
    deleteText: { ...typography.bodyMedium, color: c.danger },
  });
