import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { BadgeItem } from "@/components/BadgeItem";
import { Card } from "@/components/Card";
import { DexFrame } from "@/components/DexFrame";
import { EmptyState } from "@/components/EmptyState";
import { DexScreen } from "@/components/DexScreen";
import { FishDexCard } from "@/components/FishDexCard";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { rankColorFor, rankIconFor } from "@/constants/ranks";
import { dex as dexColors, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { compareWithFriend, getFriendFishDex, removeFriend } from "@/services/friendService";
import { getUserProfile } from "@/services/userService";
import { formatElo } from "@/utils/format";
import { AchievementPublic, FriendComparison, FriendFishDex } from "@/types";

export default function FriendProfileScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [fishdex, setFishdex] = useState<FriendFishDex | null>(null);
  const [comparison, setComparison] = useState<FriendComparison | null>(null);
  const [showcase, setShowcase] = useState<AchievementPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = Number(userId);
    if (!id) {
      setError("Usuario no válido.");
      setLoading(false);
      return;
    }
    Promise.all([getFriendFishDex(id), compareWithFriend(id), getUserProfile(id).catch(() => null)])
      .then(([dexData, comp, profile]) => {
        if (cancelled) return;
        setFishdex(dexData);
        setComparison(comp);
        setShowcase(profile?.showcase ?? []);
      })
      .catch((err) => !cancelled && setError(extractErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleRemove = () => {
    Alert.alert("Eliminar amigo", "¿Seguro que quieres eliminar a este amigo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(Number(userId));
            router.back();
          } catch (err) {
            Alert.alert("No se ha podido eliminar", extractErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) return <DexScreen title="Entrenador" onBack={() => router.back()}><LoadingScreen /></DexScreen>;
  if (error) return <DexScreen title="Entrenador" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar el perfil" description={error} /></DexScreen>;
  if (!fishdex) return <DexScreen title="Entrenador" onBack={() => router.back()}><LoadingScreen /></DexScreen>;

  const { user, dex } = fishdex;

  return (
    <DexScreen title="Entrenador" counter={`@${user.username}`} onBack={() => router.back()}>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={dex.species}
      keyExtractor={(item) => String(item.dex_number)}
      numColumns={3}
      columnWrapperStyle={styles.gridRow}
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Card style={styles.profileCard}>
            <Avatar uri={user.avatar} name={user.display_name} size={76} />
            <Text style={styles.name}>{user.display_name}</Text>
            <View style={styles.rankRow}>
              <Icon name={rankIconFor(user.rank.key)} size={14} color={rankColorFor(user.rank.key)} filled />
              <Text style={styles.rank}>
                {user.rank.name} · {formatElo(user.elo)} ELO
              </Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton
                label="Retar"
                icon="swords"
                compact
                onPress={() => router.push({ pathname: "/challenges/new", params: { friendId: String(user.id) } })}
              />
              <PrimaryButton label="Eliminar" variant="secondary" compact onPress={handleRemove} />
            </View>
          </Card>

          {showcase.length > 0 ? (
            <Card>
              <Text style={styles.overline}>VITRINA</Text>
              <View style={styles.showcaseRow}>
                {showcase.map((badge) => (
                  <BadgeItem key={badge.code} achievement={badge} size={58} />
                ))}
              </View>
            </Card>
          ) : null}

          {comparison ? (
            <Card>
              <Text style={styles.overline}>COMPARACIÓN</Text>
              <View style={styles.compareHeader}>
                <Text style={styles.compareWho}>Tú</Text>
                <Icon name="swords" size={16} color={colors.textMuted} />
                <Text style={styles.compareWho} numberOfLines={1}>
                  {user.display_name}
                </Text>
              </View>
              <CompareLine label="ELO" me={comparison.me.user.elo} friend={comparison.friend.user.elo} />
              <CompareLine label="Especies" me={comparison.me.species_discovered} friend={comparison.friend.species_discovered} />
              <CompareLine label="Raras+" me={comparison.me.rare_plus_species} friend={comparison.friend.rare_plus_species} />
              <CompareLine label="Legendarias" me={comparison.me.legendary_plus_species} friend={comparison.friend.legendary_plus_species} />
            </Card>
          ) : null}

          <DexFrame title="SU FISHDEX" counter={`${dex.discovered}/${dex.total}`} screenStyle={{ padding: 4 }}>
            <Text style={styles.dexHint}>Toca una especie que ya tengas para ver su ficha.</Text>
          </DexFrame>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <FishDexCard species={item} onPress={() => item.unlocked && router.push(`/fishdex/${item.id}`)} />
        </View>
      )}
    />
    </DexScreen>
  );
}

function CompareLine({ label, me, friend }: { label: string; me: number; friend: number }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const meWins = me > friend;
  const friendWins = friend > me;
  return (
    <View style={styles.compareRow}>
      <Text style={[styles.compareValue, meWins && { color: colors.success }]}>{formatElo(me)}</Text>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={[styles.compareValue, styles.alignRight, friendWins && { color: colors.success }]}>{formatElo(friend)}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    list: { padding: spacing.md, paddingBottom: spacing.xl },
    gridRow: { gap: 6, marginBottom: 6 },
    cell: { flex: 1 / 3 },
    profileCard: { alignItems: "center", paddingVertical: spacing.lg, borderRadius: radius.xl },
    name: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary, marginTop: spacing.sm },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    rank: { ...typography.body, color: c.textSecondary },
    actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    overline: { ...typography.overline, color: c.textMuted, marginBottom: spacing.sm },
    showcaseRow: { flexDirection: "row", justifyContent: "space-around" },
    compareHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    compareWho: { ...typography.subtitle, color: c.textPrimary, flex: 1, textAlign: "center" },
    compareRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    compareValue: { ...typography.subtitle, color: c.textPrimary, flex: 1 },
    alignRight: { textAlign: "right" },
    compareLabel: { ...typography.caption, color: c.textMuted, flex: 1, textAlign: "center" },
    dexHint: { fontFamily: typography.body.fontFamily, fontSize: 12, color: dexColors.screenMuted, textAlign: "center" },
  });
