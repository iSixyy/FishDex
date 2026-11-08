import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { BORDER, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles } from "@/context/ThemeContext";
import { report } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { Alert } from "@/utils/alert";
import { ReportReason, ReportTarget } from "@/types";

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "FAKE_CAPTURE", label: "Captura falsa", hint: "Medidas o especie imposibles, foto robada..." },
  { value: "OFFENSIVE", label: "Ofensivo o acoso", hint: "Insultos, amenazas, odio." },
  { value: "INAPPROPRIATE", label: "Foto inapropiada", hint: "Contenido que no es de pesca o explícito." },
  { value: "SPAM", label: "Spam", hint: "Publicidad o mensajes repetidos." },
  { value: "OTHER", label: "Otro motivo", hint: "Cuéntanos qué pasa." },
];

const TITLES: Record<ReportTarget, string> = {
  USER: "Reportar usuario",
  CAPTURE: "Reportar captura",
  COMMENT: "Reportar comentario",
};

interface Props {
  target: { type: ReportTarget; id: number } | null;
  onClose: () => void;
}

/** Hoja para reportar un usuario, una captura o un comentario. La revisa la
 * administración; quien reporta no queda expuesto. */
export function ReportModal({ target, onClose }: Props) {
  const styles = useStyles(makeStyles);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (target) {
      setReason(null);
      setDetails("");
    }
  }, [target]);

  const submit = async () => {
    if (!target || !reason) return;
    setSending(true);
    try {
      await report(target.type, target.id, reason, details.trim() || undefined);
      onClose();
      Alert.alert("Gracias por avisar", "La administración revisará el reporte. Nadie sabrá que has sido tú.");
    } catch (err) {
      Alert.alert("No se ha podido enviar", extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{target ? TITLES[target.type] : ""}</Text>
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {REASONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setReason(option.value)}
              style={[styles.option, reason === option.value && styles.optionOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === option.value }}
            >
              <View style={[styles.radio, reason === option.value && styles.radioOn]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </View>
            </Pressable>
          ))}
          <TextField
            label="Detalles (opcional)"
            value={details}
            onChangeText={setDetails}
            maxLength={500}
            multiline
            placeholder="Añade lo que nos ayude a revisarlo"
          />
        </ScrollView>
        <PrimaryButton label="Enviar reporte" variant="danger" onPress={submit} loading={sending} disabled={!reason} />
        <PrimaryButton label="Cancelar" variant="secondary" onPress={onClose} style={{ marginTop: spacing.sm }} />
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: c.scrim },
    sheet: {
      backgroundColor: c.background,
      borderTopWidth: BORDER + 1,
      borderColor: c.border,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    title: { ...typography.title, color: c.textPrimary, marginBottom: spacing.md },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      padding: spacing.sm + 2,
      borderWidth: BORDER,
      borderColor: c.border,
      borderRadius: radius.sm,
      backgroundColor: c.surface,
      marginBottom: spacing.sm,
    },
    optionOn: { backgroundColor: c.accentSoft },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: BORDER, borderColor: c.border },
    radioOn: { backgroundColor: c.danger, borderColor: c.danger },
    optionLabel: { ...typography.bodyMedium, color: c.textPrimary },
    optionHint: { ...typography.captionSmall, color: c.textSecondary },
  });
