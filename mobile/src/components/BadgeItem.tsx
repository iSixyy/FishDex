import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { fonts, spacing, ThemeColors, TIER_COLORS, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { AchievementPublic } from "@/types";

/** Icono por familia de logro (el backend guarda un emoji que no usamos). */
const CATEGORY_ICONS: Record<string, IconName> = {
  captures: "hook",
  species: "layers",
  rare: "star",
  epic: "gem",
  legendary: "crown",
  heavy: "weight",
  long: "ruler",
  regions: "map",
  friends: "users",
  records: "trophy",
  photos: "camera",
  challenges: "swords",
  spots: "pin",
  release: "wave",
};

const TIER_LABEL: Record<string, string> = { BRONZE: "BRONCE", SILVER: "PLATA", GOLD: "ORO" };

export function iconForAchievement(a: AchievementPublic): IconName {
  return (a.category && CATEGORY_ICONS[a.category]) || "medal";
}

/** Insignia circular con el color de su nivel (bronce/plata/oro). */
export function BadgeItem({
  achievement,
  size = 56,
  selected = false,
  onPress,
}: {
  achievement: AchievementPublic;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const tierColor = (achievement.tier && TIER_COLORS[achievement.tier]) || colors.textMuted;
  const unlocked = achievement.unlocked;

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.item} accessibilityLabel={achievement.name}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: 6 },
          unlocked ? { borderColor: tierColor, backgroundColor: `${tierColor}22` } : styles.locked,
          selected && { borderWidth: 3, borderColor: colors.primary },
        ]}
      >
        <Icon name={unlocked ? iconForAchievement(achievement) : "lock"} size={size * 0.42} color={unlocked ? tierColor : colors.textMuted} />
      </View>
      {achievement.tier ? (
        <Text style={[styles.tier, { color: unlocked ? tierColor : colors.textMuted }]}>{TIER_LABEL[achievement.tier]}</Text>
      ) : null}
      <Text style={[styles.name, !unlocked && styles.nameLocked]} numberOfLines={2}>
        {achievement.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    item: { width: "25%", alignItems: "center", paddingHorizontal: 4, marginBottom: spacing.md },
    circle: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderBottomWidth: 4 },
    locked: { borderColor: c.border, backgroundColor: c.surfaceAlt, borderStyle: "dashed" },
    tier: { fontFamily: fonts.pixel, fontSize: 6, marginTop: 6 },
    name: { ...typography.captionSmall, color: c.textPrimary, textAlign: "center", marginTop: 3 },
    nameLocked: { color: c.textMuted },
  });
