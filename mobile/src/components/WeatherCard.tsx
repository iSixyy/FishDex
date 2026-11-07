import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Icon, IconName } from "@/components/Icon";
import { spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { formatTime } from "@/utils/format";
import { WeatherInfo } from "@/types";

const COMPASS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function windDirection(deg: number | null): string {
  if (deg == null) return "";
  return COMPASS[Math.round(deg / 45) % 8];
}

function num(value: number | null | undefined, decimals = 0): string | null {
  if (value == null) return null;
  return value.toLocaleString("es-ES", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

/** Viento, presión, temperatura del aire y del agua, oleaje, mareas y luna.
 * Los datos que no existan (p.ej. mar en un embalse) simplemente no salen. */
export function WeatherCard({ weather, title = "Condiciones" }: { weather: WeatherInfo; title?: string }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  const items: { icon: IconName; label: string; value: string | null }[] = [
    { icon: "thermometer", label: "Aire", value: num(weather.air_temperature_c) && `${num(weather.air_temperature_c)} °C` },
    { icon: "droplet", label: "Agua", value: num(weather.water_temperature_c) && `${num(weather.water_temperature_c, 1)} °C` },
    {
      icon: "wind",
      label: "Viento",
      value: num(weather.wind_speed_kmh) && `${num(weather.wind_speed_kmh)} km/h ${windDirection(weather.wind_direction_deg)}`,
    },
    { icon: "chart", label: "Presión", value: num(weather.pressure_hpa) && `${num(weather.pressure_hpa)} hPa` },
    { icon: "wave", label: "Oleaje", value: num(weather.wave_height_m, 1) && `${num(weather.wave_height_m, 1)} m` },
    {
      icon: "moon",
      label: "Luna",
      value: `${weather.moon.name} · ${Math.round(weather.moon.illumination * 100)} %`,
    },
  ];

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {weather.summary ? <Text style={styles.summary}>{weather.summary}</Text> : null}
      </View>
      <View style={styles.grid}>
        {items
          .filter((item) => item.value)
          .map((item) => (
            <View key={item.label} style={styles.item}>
              <Icon name={item.icon} size={16} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value} numberOfLines={1}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
      </View>
      {weather.tides.length > 0 ? (
        <View style={styles.tides}>
          {weather.tides.slice(0, 4).map((tide) => (
            <View key={tide.time} style={styles.tide}>
              <Text style={styles.tideType}>{tide.type === "HIGH" ? "Pleamar" : "Bajamar"}</Text>
              <Text style={styles.tideTime}>{formatTime(tide.time)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    title: { ...typography.sectionTitle, color: c.textPrimary },
    summary: { ...typography.caption, color: c.textSecondary },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm },
    item: { width: "50%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingRight: spacing.sm },
    label: { ...typography.captionSmall, color: c.textMuted },
    value: { ...typography.bodyMedium, fontSize: 14, color: c.textPrimary },
    tides: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    tide: { alignItems: "center" },
    tideType: { ...typography.captionSmall, color: c.textMuted },
    tideTime: { ...typography.bodyMedium, color: c.textPrimary },
  });
