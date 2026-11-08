import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { BadgeItem } from "@/components/BadgeItem";
import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { EmptyState } from "@/components/EmptyState";
import { Icon, IconName } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { rankColorFor, rankIconFor } from "@/constants/ranks";
import { fonts, radius, SEASON_TIER_COLORS, spacing, TAB_BAR_HEIGHT, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { getAchievements } from "@/services/achievementService";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import { getMyCaptures } from "@/services/captureService";
import { getFishDex } from "@/services/fishService";
import { getMyProfile, updateShowcase } from "@/services/userService";
import { formatElo, formatLength, formatWeight } from "@/utils/format";
import { AchievementPublic, CapturePublic, UserProfile } from "@/types";
import { Alert } from "@/utils/alert";

const ACHIEVEMENTS_PREVIEW_COUNT = 8;
const SHOWCASE_SIZE = 3;

export default function ProfileScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [captures, setCaptures] = useState<CapturePublic[]>([]);
  const [achievements, setAchievements] = useState<AchievementPublic[]>([]);
  const [legendaryCount, setLegendaryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editingShowcase, setEditingShowcase] = useState(false);
  const [showcaseDraft, setShowcaseDraft] = useState<string[]>([]);
  const [savingShowcase, setSavingShowcase] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([getMyProfile(), getMyCaptures(), getAchievements(), getFishDex()])
        .then(([profileData, capturesData, achievementsData, dex]) => {
          if (cancelled) return;
          setProfile(profileData);
          setUser(profileData.user);
          setCaptures(capturesData);
          setAchievements(achievementsData);
          setLegendaryCount(dex.species.filter((s) => s.unlocked && (s.rarity === "LEGENDARY" || s.rarity === "MYTHIC")).length);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(extractErrorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [setUser])
  );

  if (loading) return <DexScreen title="Perfil" onBack={() => router.back()}><LoadingScreen message="Cargando perfil..." /></DexScreen>;
  if (error && !profile) return <DexScreen title="Perfil" onBack={() => router.back()}><EmptyState icon="alert" title="No se ha podido cargar el perfil" description={error} /></DexScreen>;
  if (!profile) return <DexScreen title="Perfil" onBack={() => router.back()}><LoadingScreen message="Cargando perfil..." /></DexScreen>;

  const { user, stats, showcase } = profile;
  const heaviest = [...captures].sort((a, b) => b.weight_kg - a.weight_kg)[0] ?? null;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const visibleAchievements = showAll ? achievements : achievements.slice(0, ACHIEVEMENTS_PREVIEW_COUNT);

  const openShowcaseEditor = () => {
    setShowcaseDraft(showcase.map((b) => b.code));
    setEditingShowcase(true);
  };

  const toggleDraft = (code: string) => {
    setShowcaseDraft((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : prev.length >= SHOWCASE_SIZE ? prev : [...prev, code]
    );
  };

  const saveShowcase = async () => {
    setSavingShowcase(true);
    try {
      const updated = await updateShowcase(showcaseDraft);
      setProfile(updated);
      setEditingShowcase(false);
    } catch (err) {
      Alert.alert("No se ha podido guardar la vitrina", extractErrorMessage(err));
    } finally {
      setSavingShowcase(false);
    }
  };

  return (
    <DexScreen
      title="Perfil"
      counter={`No.${String(user.id).padStart(3, "0")} · Pescador`}
      onBack={() => router.back()}
      action={{ icon: "settings", label: "Ajustes", onPress: () => router.push("/settings") }}
    >
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
      <View style={styles.trainerCard}>
        <Avatar uri={user.avatar} name={user.display_name} size={84} ring />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardLabel}>NOMBRE</Text>
          <Text style={styles.displayName} numberOfLines={1}>{user.display_name.toUpperCase()}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <View style={styles.rankCapsule}>
            <Icon name={rankIconFor(user.rank.key)} size={14} color={rankColorFor(user.rank.key)} filled />
            <Text style={styles.rankCapsuleText}>{user.rank.name}</Text>
            <Text style={styles.rankElo}>· {formatElo(user.elo)} ELO</Text>
          </View>
        </View>
      </View>
      <Card style={styles.statsRow}>
        <StatColumn label="Especies" value={String(stats.species_discovered)} />
        <View style={styles.statDivider} />
        <StatColumn label="Capturas" value={String(stats.total_captures)} />
        <View style={styles.statDivider} />
        <StatColumn label="Raras+" value={String(stats.rare_plus_species)} />
        <View style={styles.statDivider} />
        <StatColumn label="Legend." value={String(legendaryCount)} />
      </Card>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.overline}>VITRINA</Text>
        {unlockedCount > 0 ? (
          <Pressable onPress={openShowcaseEditor} hitSlop={8}>
            <Text style={styles.sectionLink}>Editar</Text>
          </Pressable>
        ) : null}
      </View>
      <Card style={styles.showcase}>
        {showcase.length === 0 ? (
          <Text style={styles.muted}>Desbloquea logros para exhibirlos aquí. Tus amigos los verán en tu perfil.</Text>
        ) : (
          <View style={styles.showcaseRow}>
            {showcase.map((badge) => (
              <BadgeItem key={badge.code} achievement={badge} size={64} />
            ))}
          </View>
        )}
      </Card>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.overline}>TEMPORADAS</Text>
        <Pressable onPress={() => router.push({ pathname: "/ranking", params: { scope: "season" } })} hitSlop={8}>
          <Text style={styles.sectionLink}>Ver temporada</Text>
        </Pressable>
      </View>
      {profile.season_awards && profile.season_awards.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonList}>
          {profile.season_awards.map((award) => (
            <Card key={award.season_key} style={styles.seasonCard}>
              <Icon
                name={award.tier === "PARTICIPANT" ? "medal" : "trophy"}
                size={30}
                color={SEASON_TIER_COLORS[award.tier]}
                filled
              />
              <Text style={styles.seasonTier} numberOfLines={2}>{award.tier_label}</Text>
              <Text style={styles.muted} numberOfLines={1}>{award.season_name.replace("Temporada de ", "")}</Text>
              <Text style={styles.seasonPos}>{award.position}.º · {award.points} pts</Text>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <Card onPress={() => router.push({ pathname: "/ranking", params: { scope: "season" } })} style={styles.biggestCard}>
          <Icon name="flame" size={26} color={colors.cta} filled />
          <View style={{ flex: 1 }}>
            <Text style={styles.biggestName}>Aún sin insignias de temporada</Text>
            <Text style={styles.muted}>Cada 3 meses el ranking empieza de cero. ¡Entra en el top 10!</Text>
          </View>
        </Card>
      )}

      <Text style={[styles.overline, styles.sectionPad]}>MI MAYOR CAPTURA</Text>
      {heaviest ? (
        <Card onPress={() => router.push(`/capture/${heaviest.id}`)} style={styles.biggestCard}>
          {heaviest.thumbnail_url ? (
            <Image source={{ uri: mediaUrl(heaviest.thumbnail_url) }} style={styles.biggestThumb} />
          ) : (
            <View style={[styles.biggestThumb, styles.thumbEmpty]}>
              <Icon name="fish" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.biggestName}>{heaviest.fish_species_name}</Text>
            <Text style={styles.muted}>
              {formatWeight(heaviest.weight_kg)} · {formatLength(heaviest.length_cm)}
            </Text>
            {heaviest.location_name ? <Text style={styles.muted}>{heaviest.location_name}</Text> : null}
          </View>
        </Card>
      ) : (
        <EmptyState icon="hook" title="Aún no tienes capturas" description="Registra tu primera captura para verla aquí." />
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.overline}>
          LOGROS · {unlockedCount}/{achievements.length}
        </Text>
        {achievements.length > ACHIEVEMENTS_PREVIEW_COUNT ? (
          <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
            <Text style={styles.sectionLink}>{showAll ? "Ver menos" : "Ver todos"}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.badgesGrid}>
        {visibleAchievements.map((a) => (
          <BadgeItem key={a.code} achievement={a} onPress={() => Alert.alert(a.name, a.description)} />
        ))}
      </View>

      <Text style={[styles.overline, styles.sectionPad]}>MÁS</Text>
      <View style={styles.links}>
        <LinkRow icon="chart" label="Estadísticas" onPress={() => router.push("/stats")} />
        <LinkRow icon="trophy" label="Ranking" onPress={() => router.push("/ranking")} />
        <LinkRow icon="settings" label="Ajustes y apariencia" onPress={() => router.push("/settings")} />
      </View>

      <Modal visible={editingShowcase} transparent animationType="slide" onRequestClose={() => setEditingShowcase(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.modalTitle}>tu vitrina.</Text>
            <Text style={styles.muted}>Elige hasta {SHOWCASE_SIZE} insignias ({showcaseDraft.length}/{SHOWCASE_SIZE}).</Text>
            <ScrollView style={{ maxHeight: 380, marginTop: spacing.md }}>
              <View style={styles.badgesGrid}>
                {achievements
                  .filter((a) => a.unlocked)
                  .map((a) => (
                    <BadgeItem key={a.code} achievement={a} selected={showcaseDraft.includes(a.code)} onPress={() => toggleDraft(a.code)} />
                  ))}
              </View>
            </ScrollView>
            <PrimaryButton label="Guardar" onPress={saveShowcase} loading={savingShowcase} />
            <Pressable onPress={() => setShowcaseDraft([])} style={styles.modalLink}>
              <Text style={styles.sectionLink}>Automática (mis mejores insignias)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </DexScreen>
  );
}

function StatColumn({ label, value }: { label: string; value: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={styles.linkRow}>
      <Icon name={icon} size={18} color={colors.textPrimary} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    trainerCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      margin: spacing.sm,
      padding: spacing.md - 4,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: c.border,
      borderRadius: radius.md,
    },
    cardLabel: { ...typography.overline, fontSize: 7, color: c.textMuted },
    displayName: { ...typography.sectionTitle, fontSize: 12, color: c.textPrimary },
    username: { ...typography.body, color: c.textSecondary },
    rankCapsule: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    rankCapsuleText: { ...typography.bodyMedium, color: c.textPrimary },
    rankElo: { ...typography.body, color: c.textSecondary },
    statsRow: { flexDirection: "row", marginHorizontal: spacing.sm, paddingVertical: spacing.md },
    statColumn: { flex: 1, alignItems: "center" },
    statValue: { ...typography.stat, fontSize: 16, color: c.textPrimary },
    statLabel: { ...typography.captionSmall, color: c.textMuted, marginTop: 2 },
    statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.border },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionPad: { paddingHorizontal: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
    overline: { ...typography.overline, color: c.textPrimary },
    sectionLink: { ...typography.caption, color: c.textPrimary, textDecorationLine: "underline" },
    showcase: { marginHorizontal: spacing.sm },
    showcaseRow: { flexDirection: "row", justifyContent: "space-around" },
    muted: { ...typography.caption, color: c.textSecondary },
    biggestCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.sm },
    seasonList: { gap: spacing.sm, paddingHorizontal: spacing.sm },
    seasonCard: { width: 132, alignItems: "center", gap: 4 },
    seasonTier: { ...typography.pixelSmall, fontSize: 8, lineHeight: 12, color: c.textPrimary, textAlign: "center" },
    seasonPos: { ...typography.captionSmall, color: c.textSecondary },
    biggestThumb: { width: 64, height: 64, borderRadius: radius.sm, borderWidth: 2, borderColor: c.border },
    thumbEmpty: { backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" },
    biggestName: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 16, color: c.textPrimary, marginBottom: 4 },
    badgesGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.sm },
    links: { paddingHorizontal: spacing.sm, gap: spacing.sm },
    linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    linkLabel: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" },
    modalSheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 2, borderColor: c.border, padding: spacing.lg },
    modalTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    modalLink: { alignItems: "center", marginTop: spacing.md },
  });
