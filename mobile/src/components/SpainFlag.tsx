import React from "react";
import Svg, { Rect } from "react-native-svg";

/** Bandera de España simplificada (franjas rojo-amarillo-rojo), para el pie
 *  de la pantalla de bienvenida. Se dibuja en vez de usar el emoji 🇪🇸, que
 *  no se renderiza igual en todos los Android. */
export function SpainFlag({ width = 18 }: { width?: number }) {
  const height = (width * 2) / 3;
  return (
    <Svg width={width} height={height} viewBox="0 0 30 20" accessibilityLabel="España">
      <Rect x="0" y="0" width="30" height="20" rx="2.5" fill="#C60B1E" />
      <Rect x="0" y="5.5" width="30" height="9" fill="#FFC400" />
    </Svg>
  );
}
