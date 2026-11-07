import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { User } from "@/types";

/** Lista de amigos con casillas, para compartir spots o crear torneos. */
export function FriendPicker({
  friends,
  selected,
  onToggle,
}: {
  friends: User[];
  selected: Set<number>;
  onToggle: (userId: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  if (friends.length === 0) {
    return <Text style={styles.empty}>Aún no tienes amigos. Añádelos desde Social.</Text>;
  }
  return (
    <View>
      {friends.map((friend) => {
        const on = selected.has(friend.id);
        return (
          <Pressable key={friend.id} onPress={() => onToggle(friend.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Avatar uri={friend.avatar} name={friend.display_name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{friend.display_name}</Text>
              <Text style={styles.username}>@{friend.username}</Text>
            </View>
            <View style={[styles.check, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {on ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={2.4} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    name: { ...typography.bodyMedium, color: c.textPrimary },
    username: { ...typography.caption, color: c.textMuted },
    check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
    empty: { ...typography.body, color: c.textSecondary },
  });
