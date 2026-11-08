import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { Icon } from "@/components/Icon";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { fonts, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { getLicense, saveLicense } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { Alert } from "@/utils/alert";
import { FishingLicense } from "@/types";

/** "2027-03-25" -> "25/03/2027" */
function toDisplay(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "25/03/2027" -> "2027-03-25" (null si no es una fecha válida). */
function toIso(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Licencia de pesca: fecha de caducidad y comunidad. FishDex avisa por push
 * a 30 días, a 7 días y el día que caduca. */
export default function LicenseScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [license, setLicense] = useState<FishingLicense | null>(null);
  const [date, setDate] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLicense()
      .then((data) => {
        setLicense(data);
        setDate(toDisplay(data.expires_on));
        setRegion(data.region ?? "");
      })
      .catch(() => setLicense({ expires_on: null, region: null, days_left: null }));
  }, []);

  const save = async (clear = false) => {
    const iso = clear ? null : toIso(date);
    if (!clear && !iso) return Alert.alert("Fecha no válida", "Escribe la fecha de caducidad como DD/MM/AAAA.");
    setSaving(true);
    try {
      const saved = await saveLicense(iso, clear ? null : region.trim() || null);
      setLicense(saved);
      if (clear) {
        setDate("");
        setRegion("");
      }
    } catch (err) {
      Alert.alert("No se ha podido guardar", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!license) return <DexScreen title="Licencia" onBack={() => router.back()}><LoadingScreen /></DexScreen>;

  const days = license.days_left;
  const tone = days == null ? colors.textMuted : days < 0 ? colors.danger : days <= 30 ? colors.warning : colors.success;
  const status =
    days == null
      ? "Sin licencia guardada"
      : days < 0
        ? `Caducada hace ${-days} días`
        : days === 0
          ? "Caduca hoy"
          : `Válida · quedan ${days} días`;

  return (
    <DexScreen title="Licencia" counter="Licencia de pesca" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.statusCard}>
          <Icon name="flag" size={28} color={tone} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.status, { color: tone }]}>{status}</Text>
            {license.expires_on ? (
              <Text style={styles.statusSub}>
                Caduca el {toDisplay(license.expires_on)}
                {license.region ? ` · ${license.region}` : ""}
              </Text>
            ) : (
              <Text style={styles.statusSub}>Guárdala y te avisamos antes de que caduque.</Text>
            )}
          </View>
        </Card>
        <Card>
          <TextField label="Caduca el" value={date} onChangeText={setDate} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" maxLength={10} />
          <TextField label="Comunidad (opcional)" value={region} onChangeText={setRegion} placeholder="Galicia" maxLength={80} />
          <Text style={styles.hint}>Te avisaremos a 30 días, a 7 días y el día que caduque.</Text>
        </Card>
        <PrimaryButton label="Guardar licencia" onPress={() => save(false)} loading={saving} />
        {license.expires_on ? (
          <PrimaryButton label="Borrar licencia" variant="secondary" onPress={() => save(true)} disabled={saving} />
        ) : null}
      </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    statusCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    status: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 17 },
    statusSub: { ...typography.caption, color: c.textSecondary, marginTop: 4 },
    hint: { ...typography.captionSmall, color: c.textMuted },
  });
