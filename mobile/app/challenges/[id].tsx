import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { HeroCard } from "@/components/HeroCard";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { cancelChallenge, getChallenge, joinEvent, respondChallenge } from "@/services/challengeService";
import { formatDate, formatLength, formatWeight } from "@/utils/format";
import { Challenge } from "@/types";

const KIND_LABEL = { DUEL: "Reto 1 contra 1", TOURNAMENT: "Torneo", EVENT: "Evento oficial" } as const;
const STATUS_LABEL = { PENDING: "Esperando respuesta", ACTIVE: "En curso", FINISHED: "Terminado", CANCELLED: "Cancelado" } as const;
const PARTICIPANT_LABEL = { INVITED: "Invitado", ACCEPTED: "Participa", DECLINED: "Rechazado" } as const;

function daysLeft(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Termina ya";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `Quedan ${days} d ${hours} h` : `Quedan ${hours} h`;
}

export default function ChallengeDetailScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const challengeId = Number(id);
    if (!challengeId) {
      setError("Reto no válido.");
      setLoading(false);
      return;
    }
    try {
      setChallenge(await getChallenge(challengeId));
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<Challenge | void>) => {
    setBusy(true);
    try {
      const result = await action();
      if (result) setChallenge(result);
    } catch (err) {
      Alert.alert("No se ha podido completar", extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <DexScreen title="Reto" onBack={() => router.back()}><LoadingScreen /></DexScreen>;
  if (error || !challenge) return <DexScreen title="Reto" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar el reto" description={error ?? undefined} /></DexScreen>;

  const formatScore = (score: number) =>
    challenge.criterion === "HEAVIEST" ? formatWeight(score) : challenge.criterion === "LONGEST" ? formatLength(score) : String(Math.round(score));
  const isCreator = challenge.creator.id === user?.id;
  const open = challenge.status === "PENDING" || challenge.status === "ACTIVE";

  return (
    <DexScreen title={KIND_LABEL[challenge.kind]} counter={STATUS_LABEL[challenge.status]} onBack={() => router.back()}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.textPrimary} />}
    >
      <Stack.Screen options={{ title: KIND_LABEL[challenge.kind] }} />
      <HeroCard
        eyebrow={`${KIND_LABEL[challenge.kind]} · ${STATUS_LABEL[challenge.status]}`}
        title={challenge.title}
      >
        <Text style={styles.heroMeta}>
          Gana quien consiga {challenge.criterion_label}
          {challenge.species_name ? ` de ${challenge.species_name}` : ""}.
        </Text>
        <Text style={styles.heroMeta}>
          {challenge.status === "ACTIVE"
            ? `${daysLeft(challenge.ends_at)} · hasta el ${formatDate(challenge.ends_at!)}`
            : challenge.status === "PENDING"
              ? `Durará ${challenge.duration_days} días desde que se acepte`
              : challenge.ends_at
                ? `Terminó el ${formatDate(challenge.ends_at)}`
                : ""}
        </Text>
      </HeroCard>

      {challenge.status === "FINISHED" ? (
        <Card style={styles.winnerCard}>
          <Icon name="trophy" size={28} color={colors.gold} filled={!!challenge.winner} />
          <Text style={styles.winnerText}>{challenge.winner ? `¡Ha ganado ${challenge.winner.display_name}!` : "Empate: nadie se lleva la victoria."}</Text>
        </Card>
      ) : null}

      {challenge.my_status === "INVITED" && open ? (
        <View style={styles.actions}>
          <PrimaryButton label="Aceptar reto" onPress={() => run(() => respondChallenge(challenge.id, true))} loading={busy} style={{ flex: 1 }} />
          <PrimaryButton label="Rechazar" variant="secondary" onPress={() => run(() => respondChallenge(challenge.id, false))} disabled={busy} style={{ flex: 1 }} />
        </View>
      ) : null}
      {challenge.kind === "EVENT" && challenge.my_status === null && challenge.status === "ACTIVE" ? (
        <PrimaryButton label="Apuntarme al evento" icon="flag" onPress={() => run(() => joinEvent(challenge.id))} loading={busy} />
      ) : null}

      <Text style={styles.overline}>CLASIFICACIÓN</Text>
      <Card>
        {challenge.participants.length === 0 ? (
          <Text style={styles.muted}>Aún no se ha apuntado nadie.</Text>
        ) : (
          challenge.participants.map((p) => (
            <View key={p.user.id} style={[styles.row, p.user.id === user?.id && styles.rowMe]}>
              <Text style={styles.position}>{p.status === "ACCEPTED" && p.position ? p.position : "–"}</Text>
              <Avatar uri={p.user.avatar} name={p.user.display_name} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.user.display_name}</Text>
                <Text style={styles.muted}>{PARTICIPANT_LABEL[p.status]}</Text>
              </View>
              {p.status === "ACCEPTED" ? <Text style={styles.score}>{formatScore(p.score)}</Text> : null}
            </View>
          ))
        )}
      </Card>

      {challenge.status === "ACTIVE" && challenge.my_status === "ACCEPTED" ? (
        <PrimaryButton label="Registrar captura" icon="plus" onPress={() => router.push("/catch/create")} />
      ) : null}
      {isCreator && open ? (
        <PrimaryButton
          label="Cancelar reto"
          variant="secondary"
          disabled={busy}
          onPress={() =>
            Alert.alert("Cancelar reto", "¿Seguro que quieres cancelarlo?", [
              { text: "No", style: "cancel" },
              {
                text: "Cancelar reto",
                style: "destructive",
                onPress: () =>
                  run(async () => {
                    await cancelChallenge(challenge.id);
                    return getChallenge(challenge.id);
                  }),
              },
            ])
          }
        />
      ) : null}
    </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    heroMeta: { ...typography.caption, color: c.heroTextMuted, textAlign: "center", marginTop: spacing.sm },
    winnerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    winnerText: { ...typography.subtitle, color: c.textPrimary, flex: 1 },
    actions: { flexDirection: "row", gap: spacing.sm },
    overline: { ...typography.overline, color: c.textMuted, textAlign: "center", marginTop: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radius.md },
    rowMe: { backgroundColor: c.surfaceAlt },
    position: { fontFamily: fonts.pixel, fontSize: 11, color: c.textMuted, width: 26, textAlign: "center" },
    name: { ...typography.bodyMedium, color: c.textPrimary },
    muted: { ...typography.caption, color: c.textSecondary },
    score: { ...typography.subtitle, color: c.textPrimary },
  });
