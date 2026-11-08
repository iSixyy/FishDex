import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";
import { getBlockedUsers, unblockUser } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { Alert } from "@/utils/alert";
import { User } from "@/types";

/** Usuarios bloqueados: no pueden pedirte amistad ni ves sus comentarios. */
export default function BlockedUsersScreen() {
  const styles = useStyles(makeStyles);
  const [users, setUsers] = useState<User[] | null>(null);

  const load = useCallback(() => {
    getBlockedUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);
  useEffect(load, [load]);

  const unblock = (user: User) =>
    Alert.alert("Desbloquear", `¿Desbloquear a ${user.display_name}? Podrá volver a enviarte solicitudes.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desbloquear",
        onPress: async () => {
          try {
            await unblockUser(user.id);
            load();
          } catch (err) {
            Alert.alert("No se ha podido desbloquear", extractErrorMessage(err));
          }
        },
      },
    ]);

  return (
    <DexScreen title="Bloqueados" counter={users ? `${users.length} usuario(s)` : undefined} onBack={() => router.back()}>
      {users === null ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <EmptyState icon="lock" title="No has bloqueado a nadie" description="Puedes bloquear a alguien desde su perfil." />
          }
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <Avatar uri={item.avatar} name={item.display_name} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
                <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
              </View>
              <PrimaryButton label="Desbloquear" variant="secondary" compact onPress={() => unblock(item)} />
            </Card>
          )}
        />
      )}
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    name: { ...typography.bodyMedium, color: c.textPrimary },
    username: { ...typography.captionSmall, color: c.textMuted },
  });
