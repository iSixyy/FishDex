import { router, Stack, useLocalSearchParams } from "expo-router";
import { DexScreen } from "@/components/DexScreen";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { FriendPicker } from "@/components/FriendPicker";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { TextField } from "@/components/TextField";
import { radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage } from "@/services/api";
import { createChallenge, createEvent, CRITERION_OPTIONS } from "@/services/challengeService";
import { getSpeciesCatalog } from "@/services/fishService";
import { getFriends } from "@/services/friendService";
import { ChallengeCriterion, FishCatalogEntry, User } from "@/types";
import { Alert } from "@/utils/alert";

const DURATIONS = [1, 3, 7, 14, 30];

/** Crear un reto (1 amigo), un torneo (varios) o, para administradores, un
 * evento oficial abierto a todos (`?mode=event`). `?friendId=` preselecciona. */
export default function NewChallengeScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ friendId?: string; mode?: string }>();
  const isEvent = params.mode === "event";

  const [friends, setFriends] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(params.friendId ? [Number(params.friendId)] : []));
  const [criterion, setCriterion] = useState<ChallengeCriterion>("HEAVIEST");
  const [duration, setDuration] = useState(7);
  const [title, setTitle] = useState("");
  const [catalog, setCatalog] = useState<FishCatalogEntry[]>([]);
  const [species, setSpecies] = useState<FishCatalogEntry | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEvent) getFriends().then((list) => setFriends(list.map((f) => f.user))).catch(() => undefined);
    getSpeciesCatalog().then(setCatalog).catch(() => undefined);
  }, [isEvent]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setSaving(true);
    try {
      const input = { criterion, duration_days: duration, species_id: species?.id ?? null, title: title.trim() || null };
      const challenge = isEvent
        ? await createEvent({ ...input, title: title.trim() })
        : await createChallenge(Array.from(selected), input);
      router.replace(`/challenges/${challenge.id}`);
    } catch (err) {
      Alert.alert("No se ha podido crear", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const kindLabel = isEvent ? "Evento oficial" : selected.size > 1 ? "Torneo" : "Reto 1 contra 1";
  const canSubmit = isEvent ? title.trim().length >= 3 : selected.size > 0;

  return (
    <DexScreen title={isEvent ? "Nuevo evento" : "Nuevo reto"} counter={kindLabel} onBack={() => router.back()}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: isEvent ? "Nuevo evento" : "Nuevo reto" }} />
      <Text style={styles.kind}>{kindLabel.toLowerCase()}.</Text>
      <Text style={styles.hint}>
        {isEvent
          ? "Se notificará a todos los usuarios y cualquiera podrá apuntarse."
          : "El reto empieza cuando el primer invitado acepte. Solo cuentan las capturas registradas durante el reto."}
      </Text>

      {!isEvent ? (
        <Card>
          <Text style={styles.section}>Rivales</Text>
          <FriendPicker friends={friends} selected={selected} onToggle={toggle} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.section}>¿Quién gana?</Text>
        <View style={styles.chips}>
          {CRITERION_OPTIONS.map((option) => (
            <Pressable key={option.value} onPress={() => setCriterion(option.value)} style={[styles.chip, criterion === option.value && styles.chipActive]}>
              <Text style={[styles.chipText, criterion === option.value && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.section, { marginTop: spacing.md }]}>Duración</Text>
        <View style={styles.chips}>
          {DURATIONS.map((days) => (
            <Pressable key={days} onPress={() => setDuration(days)} style={[styles.chip, duration === days && styles.chipActive]}>
              <Text style={[styles.chipText, duration === days && styles.chipTextActive]}>
                {days} {days === 1 ? "día" : "días"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.section, { marginTop: spacing.md }]}>Especie (opcional)</Text>
        <Pressable style={styles.speciesRow} onPress={() => setPickerVisible(true)}>
          <Icon name="fish" size={18} color={colors.textSecondary} />
          <Text style={styles.speciesText}>{species?.name ?? "Cualquier especie"}</Text>
          {species ? (
            <Pressable onPress={() => setSpecies(null)} hitSlop={8}>
              <Icon name="close" size={16} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          )}
        </Pressable>
      </Card>

      <TextField
        label={isEvent ? "Título del evento" : "Título (opcional)"}
        value={title}
        onChangeText={setTitle}
        placeholder={isEvent ? "Gran Liga de la Lubina" : "El que pierda paga las cañas"}
        maxLength={80}
      />

      <PrimaryButton label={isEvent ? "Publicar evento" : "Enviar reto"} onPress={submit} loading={saving} disabled={!canSubmit} />

      <SpeciesPicker
        visible={pickerVisible}
        species={catalog}
        onSelect={(s) => {
          setSpecies(s);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    kind: { ...typography.title, color: c.textPrimary },
    hint: { ...typography.body, fontSize: 14, color: c.textSecondary },
    section: { ...typography.sectionTitle, color: c.textPrimary, marginBottom: spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    chip: { borderRadius: radius.sm, borderWidth: 2, borderColor: c.border, paddingHorizontal: spacing.md, paddingVertical: 8 },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { ...typography.caption, color: c.textSecondary },
    chipTextActive: { color: c.onPrimary },
    speciesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    speciesText: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
  });
