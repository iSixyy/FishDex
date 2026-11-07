import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/components/Icon";
import { BORDER, fonts, radius, spacing, TAB_BAR_HEIGHT, ThemeColors } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";

/** Pestañas visibles, en orden, con su icono. `catch` es el hueco del botón
 * central "+" (abre el flujo de captura en vez de navegar a una pestaña). */
const TAB_ICONS: Record<string, IconName> = {
  "home/index": "home",
  "fishdex/index": "grid",
  "social/index": "users",
  "map/index": "map",
};

const CENTER_BUTTON_SIZE = 54;

/** Botonera inferior del aparato: parte baja de la carcasa, con botones
 * cuadrados y el gran botón rojo central para capturar. */
export function FishDexTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => route.name === "catch" || route.name in TAB_ICONS);

  return (
    <View style={[styles.container, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
      {visibleRoutes.map((route) => {
        if (route.name === "catch") {
          return (
            <View key={route.key} style={styles.tabItem}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nueva captura"
                hitSlop={8}
                onPress={() => router.push("/catch/create")}
                style={({ pressed }) => [styles.centerButton, pressed && styles.centerButtonPressed]}
              >
                <Icon name="plus" size={26} color={colors.onCta} strokeWidth={2.6} />
              </Pressable>
            </View>
          );
        }

        const { options } = descriptors[route.key];
        const focused = state.routes[state.index]?.key === route.key;
        const label = typeof options.title === "string" ? options.title : route.name;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
            style={styles.tabItem}
          >
            <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
              <Icon name={TAB_ICONS[route.name]} size={20} filled={focused} color={focused ? colors.shell : colors.shellText} />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: c.shellDark,
      borderTopWidth: BORDER + 1,
      borderTopColor: c.shellLight,
      paddingTop: spacing.sm,
    },
    tabItem: { flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 4 },
    iconBox: { width: 38, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
    iconBoxActive: { backgroundColor: c.shellText },
    label: { fontFamily: fonts.pixel, fontSize: 6, lineHeight: 9, color: c.shellTextMuted },
    labelActive: { color: c.shellText },
    centerButton: {
      width: CENTER_BUTTON_SIZE,
      height: CENTER_BUTTON_SIZE,
      borderRadius: CENTER_BUTTON_SIZE / 2,
      backgroundColor: c.cta,
      borderWidth: BORDER + 1,
      borderColor: c.ctaDark,
      borderBottomWidth: BORDER + 4,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -14,
    },
    centerButtonPressed: { borderBottomWidth: BORDER + 1, transform: [{ translateY: 3 }] },
  });
