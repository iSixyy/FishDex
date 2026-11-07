/** Sustituto de react-native-maps SOLO para la versión web (vista previa en
 * el navegador): la librería no tiene implementación web. En Android/iOS
 * Metro usa la librería real; ver `metro.config.js`. */
import React, { forwardRef, useImperativeHandle } from "react";
import { Text, View, ViewStyle } from "react-native";

type Props = { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode } & Record<string, unknown>;

const MapView = forwardRef<unknown, Props>(function MapView({ style }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => undefined }));
  return (
    <View
      style={[
        { backgroundColor: "#A9C8DE", alignItems: "center", justifyContent: "center", overflow: "hidden" },
        style as ViewStyle,
      ]}
    >
      {/* Retícula a modo de mapa, para que la vista previa no quede vacía. */}
      {Array.from({ length: 12 }).map((_, i) => (
        <View
          key={i}
          style={{ position: "absolute", left: 0, right: 0, top: `${i * 9}%`, height: 1, backgroundColor: "rgba(255,255,255,0.35)" }}
        />
      ))}
      <Text style={{ color: "#1C4F86", fontSize: 9, fontFamily: "PressStart2P_400Regular", textAlign: "center", lineHeight: 16 }}>
        {"MAPA DISPONIBLE\nEN LA APP MÓVIL"}
      </Text>
    </View>
  );
});

export const Marker = (_: Record<string, unknown>) => null;
export const UrlTile = (_: Record<string, unknown>) => null;
export const PROVIDER_DEFAULT = undefined;
export type LongPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };
export default MapView;
