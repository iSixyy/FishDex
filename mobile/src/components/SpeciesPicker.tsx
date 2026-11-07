import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { RarityBadge } from "@/components/RarityBadge";
import { fonts, radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { FishCatalogEntry } from "@/types";

interface Props {
  visible: boolean;
  species: FishCatalogEntry[];
  onSelect: (species: FishCatalogEntry) => void;
  onClose: () => void;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function SpeciesPicker({ visible, species, onSelect, onClose }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  // Al cerrar el modal se reinicia la búsqueda para que no se quede
  // filtrada la próxima vez que se abra.
  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return species;
    return species.filter((s) => normalize(s.name).includes(normalized));
  }, [species, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>¿qué has pescado?</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
            <Icon name="close" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.searchWrap}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar especie..."
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} onPress={() => onSelect(item)}>
              <Text style={styles.rowNumber}>{String(item.dex_number).padStart(3, "0")}</Text>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <RarityBadge rarity={item.rarity} size="sm" />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay especies que coincidan.</Text>}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingHorizontal: spacing.md },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
    title: { ...typography.title, color: c.textPrimary },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.sm,
    },
    search: { ...typography.body, flex: 1, color: c.textPrimary, paddingVertical: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowNumber: { fontFamily: fonts.pixel, fontSize: 9, color: c.textMuted, width: 34 },
    rowName: { ...typography.bodyMedium, color: c.textPrimary, flex: 1 },
    empty: { ...typography.body, color: c.textSecondary, textAlign: "center", marginTop: spacing.lg },
  });
