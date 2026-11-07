import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RarityBadge } from "@/components/RarityBadge";
import { dex, fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useGameConfig } from "@/context/GameConfigContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { formatLength, formatWeight } from "@/utils/format";
import { CaptureResult } from "@/types";

interface Props {
  visible: boolean;
  result: CaptureResult | null;
  onViewInDex: () => void;
  onContinue: () => void;
  onShare?: () => void;
}

/** Pantalla de celebración al registrar una captura: cabecera pixelada de
 * "nueva entrada en la Dex", rareza centrada, medidas, ELO y logros. */
export function CelebrationModal({ visible, result, onViewInDex, onContinue, onShare }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { rarityColor } = useGameConfig();

  // Guarda el id de la última captura celebrada para no repetir la háptica
  // cuando `result` se recrea como un objeto nuevo con los mismos datos.
  const lastCelebratedId = useRef<number | null>(null);

  useEffect(() => {
    if (!visible || !result) {
      if (!visible) lastCelebratedId.current = null;
      return;
    }
    if (lastCelebratedId.current === result.capture.id) return;
    lastCelebratedId.current = result.capture.id;
    const feedback =
      result.is_new_species || result.record.is_new_record
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning;
    Haptics.notificationAsync(feedback).catch(() => undefined);
  }, [visible, result]);

  if (!result) return null;
  const { capture, quote, record, new_achievements } = result;
  const accent = rarityColor(capture.rarity);

  return (
    // `onRequestClose` es el botón "atrás" de Android.
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onContinue}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.dexHeader}>
              <Text style={styles.dexHeaderText}>
                {capture.is_new_species ? "¡NUEVA ENTRADA!" : "¡CAPTURA REGISTRADA!"}
              </Text>
            </View>

            <View style={styles.screen}>
              <Text style={styles.fishName}>{capture.fish_species_name.toUpperCase()}</Text>
              {/* Rareza centrada bajo el nombre. */}
              <RarityBadge rarity={capture.rarity} style={styles.centeredBadge} />
              <View style={styles.measureRow}>
                <Text style={styles.measure}>{formatWeight(capture.weight_kg)}</Text>
                <Text style={styles.measure}>{formatLength(capture.length_cm)}</Text>
              </View>
            </View>

            {record.is_new_record && !capture.is_new_species ? (
              <View style={styles.recordBox}>
                <View style={styles.row}>
                  <Icon name="trophy" size={18} color={colors.warning} />
                  <Text style={styles.recordTitle}>¡Nuevo récord personal!</Text>
                </View>
                {record.previous_weight_kg != null ? (
                  <Text style={styles.recordText}>
                    Antes {formatWeight(record.previous_weight_kg)} · Ahora {formatWeight(record.new_weight_kg)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.elo, { color: accent }]}>+{capture.elo_earned} ELO</Text>
            <Text style={styles.quote}>“{quote}”</Text>

            {new_achievements.length > 0 ? (
              <View style={styles.achievementsBox}>
                {new_achievements.map((name) => (
                  <View key={name} style={styles.achievementRow}>
                    <Icon name="medal" size={16} color={colors.success} />
                    <Text style={styles.achievementText}>Logro desbloqueado: {name}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <PrimaryButton label="Ver en la FishDex" onPress={onViewInDex} style={styles.button} />
            {onShare ? (
              <PrimaryButton label="Compartir" icon="share" variant="secondary" onPress={onShare} style={styles.button} />
            ) : null}
            <PrimaryButton label="Continuar" variant="secondary" onPress={onContinue} style={styles.button} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrimStrong },
    scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
    card: { backgroundColor: c.surface, borderRadius: radius.xl, padding: spacing.lg, alignItems: "center" },
    dexHeader: { backgroundColor: dex.shell, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
    dexHeaderText: { fontFamily: fonts.pixel, fontSize: 10, color: "#FFFFFF" },
    screen: {
      alignSelf: "stretch",
      alignItems: "center",
      backgroundColor: dex.screen,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: dex.screenBorder,
      padding: spacing.md,
    },
    fishName: { fontFamily: fonts.pixel, fontSize: 15, lineHeight: 22, color: dex.screenText, textAlign: "center" },
    centeredBadge: { alignSelf: "center", marginTop: spacing.sm },
    measureRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
    measure: { fontFamily: fonts.pixelBody, fontSize: 28, color: dex.screenText },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    recordBox: { alignSelf: "stretch", alignItems: "center", marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
    recordTitle: { ...typography.subtitle, color: c.textPrimary },
    recordText: { ...typography.caption, color: c.textSecondary, marginTop: 2 },
    elo: { ...typography.stat, marginTop: spacing.md },
    quote: { ...typography.body, color: c.textSecondary, textAlign: "center", fontStyle: "italic", marginTop: spacing.sm },
    achievementsBox: { alignSelf: "stretch", marginTop: spacing.md, gap: spacing.xs, alignItems: "center" },
    achievementRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    achievementText: { ...typography.bodyMedium, color: c.textPrimary },
    button: { alignSelf: "stretch", marginTop: spacing.sm },
  });
