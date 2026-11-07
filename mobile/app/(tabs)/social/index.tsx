import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { CommunityFeed } from "@/components/CommunityFeed";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { DexScreen, ShellButton } from "@/components/DexScreen";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { TextField } from "@/components/TextField";
import { rankColorFor, rankIconFor } from "@/constants/ranks";
import { radius, spacing, TAB_BAR_HEIGHT, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { getChallenges } from "@/services/challengeService";
import { getFriends, getPendingRequests, sendFriendRequest } from "@/services/friendService";
import { formatDate, formatElo } from "@/utils/format";
import { Challenge, FriendPublic } from "@/types";

type Tab = "friends" | "community" | "challenges";

const TABS: { value: Tab; label: string }[] = [
  { value: "friends", label: "Amigos" },
  { value: "community", label: "Comunidad" },
  { value: "challenges", label: "Retos" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  ACTIVE: "En curso",
  FINISHED: "Terminado",
  CANCELLED: "Cancelado",
};

export default function SocialScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("friends");
  const [friends, setFriends] = useState<FriendPublic[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getFriends(), getPendingRequests(), getChallenges()])
        .then(([friendsList, requests, challengeList]) => {
          if (cancelled) return;
          setFriends(friendsList);
          setPendingCount(requests.length);
          setChallenges(challengeList);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(extractErrorMessage(err));
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleAddFriend = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendFriendRequest(trimmed);
      setUsername("");
      setAddModalVisible(false);
      Alert.alert("Solicitud enviada", `Se ha enviado una solicitud de amistad a ${trimmed}.`);
    } catch (err) {
      Alert.alert("No se pudo enviar la solicitud", extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };


  const tabs = <SegmentedTabs options={TABS} value={tab} onChange={setTab} style={styles.tabs} />;

  const renderChallenge = ({ item }: { item: Challenge }) => (
    <Card onPress={() => router.push(`/challenges/${item.id}`)} style={styles.challengeCard}>
      <View style={styles.challengeIcon}>
        <Icon name={item.kind === "EVENT" ? "flag" : item.kind === "TOURNAMENT" ? "trophy" : "swords"} size={20} color={colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.challengeTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.challengeMeta} numberOfLines={1}>
          {item.kind === "EVENT" ? "Evento oficial" : item.kind === "TOURNAMENT" ? "Torneo" : "Reto 1v1"} · {item.criterion_label}
          {item.ends_at && item.status === "ACTIVE" ? ` · hasta ${formatDate(item.ends_at)}` : ""}
        </Text>
      </View>
      <View style={[styles.statusPill, item.my_status === "INVITED" && styles.statusPillAlert]}>
        <Text style={[styles.statusText, item.my_status === "INVITED" && { color: colors.onPrimary }]}>
          {item.my_status === "INVITED" ? "Invitación" : STATUS_LABEL[item.status]}
        </Text>
      </View>
    </Card>
  );

  return (
    <DexScreen
      title="Social"
      counter={`${friends.length} amigos`}
      right={<ShellButton icon="trophy" label="Ranking" onPress={() => router.push("/ranking")} />}
      action={{ icon: "plus", label: "Añadir amigo", onPress: () => setAddModalVisible(true) }}
    >
      {tab === "community" ? (
        <CommunityFeed header={<View style={styles.tabsWrap}>{tabs}</View>} />
      ) : tab === "friends" ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => String(item.user.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={[styles.pad, styles.tabsWrap]}>
                {tabs}
                {pendingCount > 0 ? (
                  <Card onPress={() => router.push("/friends/requests")} style={styles.requestsCard}>
                    <Icon name="inbox" size={20} color={colors.textPrimary} />
                    <Text style={styles.requestsText}>
                      {pendingCount} {pendingCount === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
                    </Text>
                    <Icon name="chevron-right" size={18} color={colors.textMuted} />
                  </Card>
                ) : null}
                {friends.length > 1 ? (
                  <PrimaryButton
                    label="Crear torneo con amigos"
                    icon="trophy"
                    variant="secondary"
                    onPress={() => router.push("/challenges/new")}
                    style={styles.tournamentButton}
                  />
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="users" title="Aún no tienes amigos" description="Pulsa + para enviar tu primera solicitud." />
          }
          renderItem={({ item }) => (
            <View style={styles.pad}>
              <Card onPress={() => router.push(`/friends/${item.user.id}`)} style={styles.friendCard}>
                <Avatar uri={item.user.avatar} name={item.user.display_name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {item.user.display_name}
                  </Text>
                  <View style={styles.rankRow}>
                    <Icon name={rankIconFor(item.user.rank.key)} size={12} filled color={rankColorFor(item.user.rank.key)} />
                    <Text style={styles.rankName} numberOfLines={1}>
                      {item.user.rank.name} · {item.species_discovered}/{item.total_species} especies
                    </Text>
                  </View>
                </View>
                <Text style={styles.elo}>{formatElo(item.user.elo)}</Text>
              </Card>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={[styles.pad, styles.tabsWrap]}>
                {tabs}
                <View style={styles.challengeActions}>
                  <PrimaryButton label="Nuevo reto" icon="swords" compact onPress={() => router.push("/challenges/new")} />
                  {user?.is_admin ? (
                    <PrimaryButton
                      label="Evento oficial"
                      icon="flag"
                      variant="secondary"
                      compact
                      onPress={() => router.push({ pathname: "/challenges/new", params: { mode: "event" } })}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="swords" title="Sin retos todavía" description="Reta a un amigo desde su perfil o crea un torneo." />
          }
          renderItem={(info) => <View style={styles.pad}>{renderChallenge(info)}</View>}
        />
      )}

      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => !sending && setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>añadir amigo.</Text>
            <TextField
              label="Usuario"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="usuario_de_tu_amigo"
            />
            <PrimaryButton label="Enviar solicitud" onPress={handleAddFriend} loading={sending} />
            <Pressable onPress={() => !sending && setAddModalVisible(false)} style={styles.cancelLink} disabled={sending}>
              <Text style={styles.cancelLinkText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    pad: { paddingHorizontal: spacing.sm },
    tabs: { marginBottom: spacing.md },
    list: { paddingBottom: spacing.lg, gap: spacing.sm },
    tabsWrap: { paddingTop: spacing.sm },
    round: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    requestsCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
    requestsText: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    tournamentButton: { marginBottom: spacing.sm },
    error: { ...typography.caption, color: c.danger, marginBottom: spacing.sm },
    friendCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    friendName: { ...typography.subtitle, color: c.textPrimary },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    rankName: { ...typography.caption, color: c.textSecondary, flex: 1 },
    elo: { ...typography.subtitle, color: c.textPrimary },
    challengeActions: { flexDirection: "row", justifyContent: "center", gap: spacing.sm, marginBottom: spacing.md },
    challengeCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    challengeIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    challengeTitle: { ...typography.subtitle, color: c.textPrimary },
    challengeMeta: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
    statusPill: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: c.surfaceAlt },
    statusPillAlert: { backgroundColor: c.primary },
    statusText: { ...typography.captionSmall, color: c.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: c.scrim, justifyContent: "center", padding: spacing.lg },
    modalCard: { backgroundColor: c.background, borderRadius: radius.xl, padding: spacing.lg },
    modalTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary, marginBottom: spacing.md },
    cancelLink: { alignItems: "center", marginTop: spacing.md },
    cancelLinkText: { ...typography.bodyMedium, color: c.textSecondary },
  });
