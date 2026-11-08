import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { DexScreen } from "@/components/DexScreen";
import { HeroCard } from "@/components/HeroCard";
import { Icon } from "@/components/Icon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ProgressBar } from "@/components/ProgressBar";
import { ForecastCard } from "@/components/ForecastCard";
import { WeatherCard } from "@/components/WeatherCard";
import { dayKey, WeekStrip } from "@/components/WeekStrip";
import { radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { mediaUrl } from "@/services/api";
import { getRecentCaptures } from "@/services/captureService";
import { getChallenges } from "@/services/challengeService";
import { getFeed } from "@/services/feedService";
import { getFishDex } from "@/services/fishService";
import { getForecast, getWeather } from "@/services/weatherService";
import { formatElo, formatWeight } from "@/utils/format";
import { BiteForecast, CapturePublic, Challenge, FeedEntry, FishDexProgress, WeatherInfo } from "@/types";

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 14) return "buenos días.";
  if (hour < 21) return "buenas tardes.";
  return "buenas noches.";
}

/** Días seguidos con alguna captura, terminando hoy (o ayer, si hoy aún no). */
function streakDays(days: Set<string>): number {
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function challengeDay(challenge: Challenge): string | null {
  if (!challenge.starts_at) return null;
  const elapsed = Math.floor((Date.now() - new Date(challenge.starts_at).getTime()) / 86_400_000) + 1;
  return `Día ${Math.min(Math.max(elapsed, 1), challenge.duration_days)} de ${challenge.duration_days}`;
}

export default function HomeScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();

  const [captures, setCaptures] = useState<CapturePublic[]>([]);
  const [dex, setDex] = useState<FishDexProgress | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [highlights, setHighlights] = useState<FeedEntry[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [forecast, setForecast] = useState<BiteForecast | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    refreshUser();
    const results = await Promise.allSettled([getRecentCaptures(), getFishDex(), getChallenges(), getFeed("highlights", 8, 0)]);
    if (results[0].status === "fulfilled") setCaptures(results[0].value);
    if (results[1].status === "fulfilled") setDex(results[1].value);
    if (results[2].status === "fulfilled") setChallenges(results[2].value);
    if (results[3].status === "fulfilled") setHighlights(results[3].value);

    // Clima solo si el permiso de ubicación ya está concedido: la pantalla de
    // inicio no debe asaltar al usuario con un diálogo de permisos.
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.granted) {
        // Sin posición en caché (p. ej. recién instalada) se pide una de baja
        // precisión: el permiso ya está concedido, así que no sale ningún diálogo.
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (position) {
          const { latitude, longitude } = position.coords;
          const [conditions, bite] = await Promise.all([
            getWeather(latitude, longitude).catch(() => null),
            getForecast(latitude, longitude).catch(() => null),
          ]);
          setWeather(conditions);
          setForecast(bite);
        }
      }
    } catch {
      setWeather(null);
      setForecast(null);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markedDays = useMemo(() => new Set(captures.map((c) => dayKey(new Date(c.captured_at)))), [captures]);
  const streak = useMemo(() => streakDays(markedDays), [markedDays]);
  const dayCaptures = useMemo(
    () => captures.filter((c) => dayKey(new Date(c.captured_at)) === dayKey(selectedDay)),
    [captures, selectedDay]
  );
  const isToday = dayKey(selectedDay) === dayKey(new Date());

  const invitation = challenges.find((c) => c.my_status === "INVITED" && (c.status === "PENDING" || c.status === "ACTIVE"));
  const activeChallenge = challenges.find((c) => c.status === "ACTIVE" && c.my_status === "ACCEPTED");

  const heroTitle =
    dayCaptures.length > 0
      ? `${dayCaptures.length} ${dayCaptures.length === 1 ? "captura" : "capturas"} · ${new Set(dayCaptures.map((c) => c.fish_species_id)).size} especies`
      : isToday
        ? "Día nuevo, nueva captura."
        : "Sin capturas ese día.";

  return (
    <DexScreen
      title="Inicio"
      counter={greeting().replace(".", "")}
      right={
        <>
          <View style={styles.streakBox} accessibilityLabel={`Racha de ${streak} días`}>
            <Icon name="flame" size={14} color={streak > 0 ? colors.warning : colors.shellTextMuted} filled={streak > 0} />
            <Text style={styles.streakText}>{streak}</Text>
          </View>
          <Pressable onPress={() => router.push("/profile")} accessibilityLabel="Perfil" hitSlop={8}>
            <Avatar uri={user?.avatar} name={user?.display_name} size={38} />
          </Pressable>
        </>
      }
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.lg }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.textPrimary}
        />
      }
    >
      <View style={[styles.section, { marginTop: 0 }]}>
        <WeekStrip selected={selectedDay} onSelect={setSelectedDay} markedDays={markedDays} />
      </View>

      <View style={styles.section}>
        <HeroCard
          eyebrow={`${isToday ? "Hoy, " : ""}${DAY_NAMES[selectedDay.getDay()]} ${selectedDay.getDate()} de ${MONTH_NAMES[selectedDay.getMonth()]}`}
          title={heroTitle}
          actionLabel={dayCaptures.length > 0 && !isToday ? "Ver FishDex" : "Capturar"}
          onAction={() => (dayCaptures.length > 0 && !isToday ? router.push("/fishdex") : router.push("/catch/create"))}
        >
          {dayCaptures.length > 0 ? (
            <View style={styles.dayThumbs}>
              {dayCaptures.slice(0, 4).map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/capture/${c.id}`)}>
                  {c.thumbnail_url ? (
                    <Image source={{ uri: mediaUrl(c.thumbnail_url) }} style={styles.dayThumb} />
                  ) : (
                    <View style={[styles.dayThumb, styles.dayThumbEmpty]}>
                      <Icon name="fish" size={18} color={colors.heroTextMuted} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          ) : user ? (
            <Text style={styles.heroMeta}>
              {user.rank.name} · {formatElo(user.elo)} ELO
            </Text>
          ) : null}
        </HeroCard>
      </View>

      <View style={styles.section}>
        {invitation ? (
          <Card style={styles.promptCard}>
            <Text style={styles.promptTitle}>{invitation.creator.display_name} te ha retado.</Text>
            <Text style={styles.promptSub}>{invitation.kind === "TOURNAMENT" ? "Torneo" : "Reto 1 contra 1"} · {invitation.duration_days} días</Text>
            <Text style={styles.promptBody}>¿Aceptas el reto de {invitation.criterion_label}?</Text>
            <PrimaryButton label="Responder" variant="secondary" compact onPress={() => router.push(`/challenges/${invitation.id}`)} />
          </Card>
        ) : activeChallenge ? (
          <Card style={styles.promptCard}>
            <Text style={styles.promptTitle}>{activeChallenge.title.toLowerCase()}.</Text>
            <Text style={styles.promptSub}>{challengeDay(activeChallenge)}</Text>
            <Text style={styles.promptBody}>¿Quién conseguirá {activeChallenge.criterion_label}?</Text>
            <PrimaryButton label="Ver reto" variant="secondary" compact onPress={() => router.push(`/challenges/${activeChallenge.id}`)} />
          </Card>
        ) : dex ? (
          <Card style={styles.promptCard}>
            <Text style={styles.promptTitle}>tu fishdex.</Text>
            <Text style={styles.promptSub}>
              {dex.discovered} de {dex.total} especies
            </Text>
            <View style={styles.progressWrap}>
              <ProgressBar progress={dex.total ? dex.discovered / dex.total : 0} color={colors.textPrimary} />
            </View>
            <PrimaryButton label="Abrir" variant="secondary" compact onPress={() => router.push("/fishdex")} />
          </Card>
        ) : null}
      </View>

      {forecast ? (
        <View style={styles.section}>
          <ForecastCard forecast={forecast} title="¿Pican hoy aquí?" />
        </View>
      ) : null}

      {weather ? (
        <View style={styles.section}>
          <WeatherCard weather={weather} title="Aquí y ahora" />
        </View>
      ) : null}

      {highlights.length > 0 ? (
        <>
          <Text style={styles.overline}>INSPÍRATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
            {highlights.map((entry) => (
              <Pressable key={entry.id} onPress={() => router.push("/social")} style={styles.highlight}>
                {entry.thumbnail_url ? (
                  <Image source={{ uri: mediaUrl(entry.thumbnail_url) }} style={styles.highlightImage} />
                ) : (
                  <View style={[styles.highlightImage, styles.highlightEmpty]}>
                    <Icon name="fish" size={26} color={colors.textMuted} />
                  </View>
                )}
                <Text style={styles.highlightName} numberOfLines={1}>
                  {entry.fish_species_name}
                </Text>
                <Text style={styles.highlightMeta} numberOfLines={1}>
                  {formatWeight(entry.weight_kg)} · {entry.user.display_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
    </DexScreen>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    streakBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 38,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: c.shellDark,
      backgroundColor: c.shellLight,
    },
    streakText: { ...typography.button, color: c.shellText },
    section: { paddingHorizontal: spacing.sm, marginTop: spacing.md },
    heroMeta: { ...typography.caption, color: c.heroTextMuted, marginTop: spacing.sm },
    dayThumbs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    dayThumb: { width: 48, height: 48, borderRadius: radius.sm, borderWidth: 2, borderColor: c.heroText },
    dayThumbEmpty: { backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
    promptCard: { alignItems: "center", paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
    promptTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary, textAlign: "center" },
    promptSub: { ...typography.caption, color: c.textMuted, marginTop: 4 },
    promptBody: { ...typography.bodyMedium, color: c.textPrimary, textAlign: "center", marginVertical: spacing.md },
    progressWrap: { alignSelf: "stretch", marginVertical: spacing.md },
    overline: { ...typography.overline, color: c.textPrimary, textAlign: "center", marginTop: spacing.lg, marginBottom: spacing.sm },
    highlights: { paddingHorizontal: spacing.sm, gap: spacing.sm },
    highlight: { width: 140 },
    highlightImage: { width: 140, height: 140, borderRadius: radius.sm, borderWidth: 2, borderColor: c.border, backgroundColor: c.surfaceAlt },
    highlightEmpty: { alignItems: "center", justifyContent: "center" },
    highlightName: { ...typography.bodyMedium, color: c.textPrimary, marginTop: spacing.xs },
    highlightMeta: { ...typography.caption, color: c.textMuted },
  });
