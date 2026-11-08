import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextField } from "@/components/TextField";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles } from "@/context/ThemeContext";
import { removeAvatar, updateProfile, uploadAvatar } from "@/services/accountService";
import { extractErrorMessage } from "@/services/api";
import { pickFromGallery, takePhoto } from "@/services/imageService";
import { Alert } from "@/utils/alert";

/** Editar perfil: foto (cámara o galería, se recorta al cuadrado) y nombre visible. */
export default function EditProfileScreen() {
  const styles = useStyles(makeStyles);
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Si se abre la pantalla antes de que cargue la sesión, el campo nacía
  // vacío: se rellena en cuanto llega el usuario (sin pisar lo ya escrito).
  useEffect(() => {
    if (user?.display_name) setName((current) => current || user.display_name);
  }, [user?.display_name]);

  const changePhoto = () => {
    Alert.alert("Foto de perfil", undefined, [
      { text: "Cámara", onPress: () => upload(takePhoto) },
      { text: "Galería", onPress: () => upload(pickFromGallery) },
      ...(user?.avatar ? [{ text: "Quitar foto", style: "destructive" as const, onPress: clearPhoto }] : []),
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const upload = async (source: () => Promise<string | null>) => {
    const uri = await source();
    if (!uri) return;
    setUploading(true);
    try {
      setUser((await uploadAvatar(uri)).user);
    } catch (err) {
      Alert.alert("No se ha podido subir la foto", extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = async () => {
    setUploading(true);
    try {
      setUser((await removeAvatar()).user);
    } catch (err) {
      Alert.alert("No se ha podido quitar la foto", extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return Alert.alert("Nombre no válido", "Escribe al menos 2 caracteres.");
    setSaving(true);
    try {
      setUser((await updateProfile({ display_name: trimmed })).user);
      router.back();
    } catch (err) {
      Alert.alert("No se ha podido guardar", extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DexScreen title="Editar perfil" counter="Tu ficha de pescador" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.avatarCard}>
          <Avatar uri={user?.avatar} name={name || user?.display_name} size={112} ring />
          <PrimaryButton
            label={user?.avatar ? "Cambiar foto" : "Añadir foto"}
            icon="camera"
            variant="secondary"
            compact
            onPress={changePhoto}
            loading={uploading}
          />
        </Card>
        <Card>
          <TextField label="Nombre visible" value={name} onChangeText={setName} maxLength={60} placeholder="Cómo te ven tus amigos" />
          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>USUARIO</Text>
            <Text style={styles.readonlyValue}>@{user?.username}</Text>
          </View>
          <Text style={styles.hint}>El nombre de usuario no se puede cambiar: es como te encuentran tus amigos.</Text>
        </Card>
        <PrimaryButton label="Guardar" onPress={save} loading={saving} />
      </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
    avatarCard: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
    readonly: { marginTop: spacing.xs },
    readonlyLabel: { ...typography.overline, fontSize: 8, color: c.textSecondary, marginBottom: 6 },
    readonlyValue: { ...typography.body, fontSize: 22, color: c.textMuted },
    hint: { ...typography.captionSmall, color: c.textMuted, marginTop: spacing.sm },
  });
