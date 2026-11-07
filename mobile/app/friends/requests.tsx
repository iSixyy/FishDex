import { router } from "expo-router";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { acceptFriendRequest, getPendingRequests, rejectFriendRequest } from "@/services/friendService";
import { FriendRequestPublic } from "@/types";

export default function FriendRequestsScreen() {
  const styles = useStyles(makeStyles);
  const [requests, setRequests] = useState<FriendRequestPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await getPendingRequests());
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const respond = async (id: number, accept: boolean) => {
    setBusyId(id);
    try {
      if (accept) await acceptFriendRequest(id);
      else await rejectFriendRequest(id);
      // Se quita de la lista al momento (sin volver a la pantalla de carga).
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      Alert.alert(accept ? "No se ha podido aceptar la solicitud" : "No se ha podido rechazar la solicitud", extractErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <DexScreen title="Solicitudes" onBack={() => router.back()}><LoadingScreen /></DexScreen>;
  if (error) return <DexScreen title="Solicitudes" onBack={() => router.back()}><EmptyState icon="alert" title="No se han podido cargar las solicitudes" description={error} /></DexScreen>;

  return (
    <DexScreen title="Solicitudes" counter={`${requests.length} pendientes`} onBack={() => router.back()}>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={requests}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={<EmptyState icon="inbox" title="No tienes solicitudes pendientes" />}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Avatar uri={item.from_user.avatar} name={item.from_user.display_name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.from_user.display_name}</Text>
              <Text style={styles.meta}>
                @{item.from_user.username} · {item.from_user.rank.name}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryButton label="Aceptar" onPress={() => respond(item.id, true)} loading={busyId === item.id} style={styles.actionButton} />
            <PrimaryButton
              label="Rechazar"
              variant="secondary"
              onPress={() => respond(item.id, false)}
              disabled={busyId === item.id}
              style={styles.actionButton}
            />
          </View>
        </Card>
      )}
    />
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    list: { padding: spacing.md, gap: spacing.sm },
    card: { gap: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    name: { ...typography.subtitle, color: c.textPrimary },
    meta: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
    actions: { flexDirection: "row", gap: spacing.sm },
    actionButton: { flex: 1, height: 46 },
  });
