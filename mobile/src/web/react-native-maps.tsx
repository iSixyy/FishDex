/** Sustituto de react-native-maps SOLO para la versión web (vista previa en
 * el navegador): la librería no tiene implementación web. En Android/iOS
 * Metro usa la librería real; ver `metro.config.js`.
 *
 * No es un mapa de verdad: dibuja un contorno simplificado de la península y
 * proyecta encima (equirectangular) los `Marker` y `Circle`, para que pines,
 * spots y zonas del mapa de calor se vean en la vista previa. */
import React, { createContext, forwardRef, useContext, useImperativeHandle, useState } from "react";
import { LayoutChangeEvent, Text, View, ViewStyle } from "react-native";
import Svg, { Polygon } from "react-native-svg";

type LatLng = { latitude: number; longitude: number };
type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };
// El resto de props de react-native-maps (onPress, provider...) se aceptan y se ignoran.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; initialRegion?: Region; region?: Region; [key: string]: any };

const DEFAULT_REGION: Region = { latitude: 40.2, longitude: -3.7, latitudeDelta: 9, longitudeDelta: 9 };

// Contorno muy simplificado de la Península Ibérica (lon, lat).
const IBERIA: [number, number][] = [
  [-8.9, 43.3], [-7.7, 43.8], [-5.8, 43.6], [-3.8, 43.5], [-1.8, 43.4], [-1.3, 43.1], [0.7, 42.8],
  [3.2, 42.4], [3.2, 41.9], [2.1, 41.3], [0.9, 40.9], [0.3, 40.1], [-0.3, 39.4], [0.2, 38.8],
  [-0.6, 38.2], [-0.9, 37.6], [-1.7, 37.0], [-2.3, 36.8], [-4.4, 36.7], [-5.4, 36.1], [-6.0, 36.4],
  [-6.4, 36.9], [-7.4, 37.2], [-8.9, 37.0], [-8.8, 38.5], [-9.5, 38.8], [-8.9, 40.2], [-8.7, 41.9],
];

const Projection = createContext<{ project: (point: LatLng) => { x: number; y: number } } | null>(null);

const MapView = forwardRef<unknown, Props>(function MapView({ style, children, initialRegion, region }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => undefined }));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const view = region ?? initialRegion ?? DEFAULT_REGION;
  // Se ajusta la escala al lado más restrictivo para no deformar el mapa.
  const degPerPx = Math.max(view.longitudeDelta / (size.width || 1), view.latitudeDelta / (size.height || 1));
  const project = ({ latitude, longitude }: LatLng) => ({
    x: size.width / 2 + (longitude - view.longitude) / degPerPx,
    y: size.height / 2 - (latitude - view.latitude) / degPerPx,
  });

  return (
    <View
      style={[{ backgroundColor: "#A9C8DE", overflow: "hidden" }, style as ViewStyle]}
      onLayout={(e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <View
          key={i}
          style={{ position: "absolute", left: 0, right: 0, top: `${i * 9}%`, height: 1, backgroundColor: "rgba(255,255,255,0.3)" }}
        />
      ))}
      {size.width > 0 ? (
        <>
          <Svg width={size.width} height={size.height} style={{ position: "absolute", left: 0, top: 0 }}>
            <Polygon
              points={IBERIA.map(([lon, lat]) => {
                const { x, y } = project({ latitude: lat, longitude: lon });
                return `${x},${y}`;
              }).join(" ")}
              fill="#E6E0C8"
              stroke="#8A9A7B"
              strokeWidth={1.5}
            />
          </Svg>
          <Projection.Provider value={{ project }}>{children}</Projection.Provider>
        </>
      ) : null}
      <Text
        style={{
          position: "absolute",
          left: 8,
          top: 8,
          color: "#1C4F86",
          fontSize: 7,
          fontFamily: "PressStart2P_400Regular",
          opacity: 0.7,
        }}
      >
        VISTA PREVIA WEB
      </Text>
    </View>
  );
});

export function Marker({ coordinate, children, onPress }: { coordinate: LatLng; children?: React.ReactNode; onPress?: () => void }) {
  const projection = useContext(Projection);
  if (!projection) return null;
  const { x, y } = projection.project(coordinate);
  return (
    // Caja de 0x0 en el punto y contenido centrado (desborda): el marcador
    // queda centrado sobre la coordenada sin necesidad de medirlo.
    <View
      style={{ position: "absolute", left: x, top: y, width: 0, height: 0, alignItems: "center", justifyContent: "center", overflow: "visible" }}
      onTouchEnd={onPress}
    >
      {children ?? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#E4572E", borderWidth: 2, borderColor: "#fff" }} />}
    </View>
  );
}

/** Círculo en metros, como el de react-native-maps. */
export function Circle({
  center,
  radius,
  fillColor = "rgba(228,87,46,0.35)",
  strokeColor = "transparent",
  strokeWidth = 0,
}: {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}) {
  const projection = useContext(Projection);
  if (!projection) return null;
  const c = projection.project(center);
  const edge = projection.project({ latitude: center.latitude + radius / 111_000, longitude: center.longitude });
  const r = Math.max(4, Math.abs(c.y - edge.y));
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: c.x - r,
        top: c.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: fillColor,
        borderColor: strokeColor,
        borderWidth: strokeWidth,
      }}
    />
  );
}

export const UrlTile = (_: Record<string, unknown>) => null;
export const PROVIDER_DEFAULT = undefined;
export type LongPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };
export default MapView;
