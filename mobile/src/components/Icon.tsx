import React from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

import { useTheme } from "@/context/ThemeContext";

/** Set de iconos de línea propio de FishDex.
 *
 * Todos comparten rejilla de 24x24, trazo redondeado y grosor uniforme, para
 * que la interfaz tenga una voz gráfica consistente en lugar de emojis del
 * sistema (que cambian de estilo según el dispositivo y desentonan con la
 * tipografía serif). Los iconos "rellenables" (corazón, estrella, marcador)
 * aceptan `filled` para su estado activo. */

export type IconName =
  | "home"
  | "map"
  | "users"
  | "user"
  | "globe"
  | "plus"
  | "search"
  | "settings"
  | "sliders"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "chevron-right"
  | "close"
  | "check"
  | "fish"
  | "hook"
  | "weight"
  | "ruler"
  | "ruler-h"
  | "pin"
  | "calendar"
  | "clock"
  | "camera"
  | "gallery"
  | "flash"
  | "flash-off"
  | "heart"
  | "comment"
  | "share"
  | "more"
  | "star"
  | "crown"
  | "trophy"
  | "medal"
  | "gem"
  | "eye"
  | "chart"
  | "flame"
  | "layers"
  | "locate"
  | "info"
  | "alert"
  | "help"
  | "inbox"
  | "swords"
  | "offline"
  | "lock"
  | "bell"
  | "sun"
  | "moon"
  | "wind"
  | "wave"
  | "thermometer"
  | "droplet"
  | "edit"
  | "trash"
  | "sparkle"
  | "grid"
  | "list"
  | "flag";

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Variante rellena para estados activos (me gusta, favorito...). */
  filled?: boolean;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color, filled = false, strokeWidth = 2.1 }: Props) {
  const { colors } = useTheme();
  color = color ?? colors.textPrimary;
  const stroke = color;
  const fill = filled ? color : "none";
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none" as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, common, fill, color, strokeWidth, colors.surface)}
    </Svg>
  );
}

function renderPaths(
  name: IconName,
  c: {
    stroke: string;
    strokeWidth: number;
    strokeLinecap: "round";
    strokeLinejoin: "round";
    fill: "none";
  },
  fill: string,
  color: string,
  sw: number,
  surface: string
): React.ReactNode {
  switch (name) {
    case "home":
      return (
        <>
          <Path {...c} d="M3 10.2 12 3.5l9 6.7" />
          <Path {...c} fill={fill} d="M5.5 9.6V20h13V9.6" />
          <Path {...c} d="M9.8 20v-5.4h4.4V20" />
        </>
      );
    case "map":
      return (
        <>
          <Path {...c} d="M9 4.2 3.5 6.6v13.2L9 17.4l6 2.4 5.5-2.4V4.2L15 6.6 9 4.2Z" />
          <Line {...c} x1="9" y1="4.2" x2="9" y2="17.4" />
          <Line {...c} x1="15" y1="6.6" x2="15" y2="19.8" />
        </>
      );
    case "users":
      return (
        <>
          <Circle {...c} cx="9" cy="8" r="3.3" />
          <Path {...c} d="M3.4 19.6c0-3.1 2.5-5.3 5.6-5.3s5.6 2.2 5.6 5.3" />
          <Path {...c} d="M16.2 5.2a3.3 3.3 0 0 1 0 6.1" />
          <Path {...c} d="M17.6 14.7c1.9.6 3.1 2.4 3.1 4.9" />
        </>
      );
    case "user":
      return (
        <>
          <Circle {...c} cx="12" cy="8" r="3.6" />
          <Path {...c} d="M5 20.2c0-3.4 3.1-5.8 7-5.8s7 2.4 7 5.8" />
        </>
      );
    case "globe":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="8.4" />
          <Line {...c} x1="3.6" y1="12" x2="20.4" y2="12" />
          <Path {...c} d="M12 3.6c2.1 2.3 3.3 5.3 3.3 8.4s-1.2 6.1-3.3 8.4c-2.1-2.3-3.3-5.3-3.3-8.4S9.9 5.9 12 3.6Z" />
        </>
      );
    case "plus":
      return (
        <>
          <Line {...c} x1="12" y1="5" x2="12" y2="19" />
          <Line {...c} x1="5" y1="12" x2="19" y2="12" />
        </>
      );
    case "search":
      return (
        <>
          <Circle {...c} cx="11" cy="11" r="6.6" />
          <Line {...c} x1="15.8" y1="15.8" x2="20.5" y2="20.5" />
        </>
      );
    case "settings":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="3.1" />
          <Path
            {...c}
            d="M19.1 14.2a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1A1.8 1.8 0 1 1 7.7 4.5l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.4.9Z"
          />
        </>
      );
    case "sliders":
      return (
        <>
          <Line {...c} x1="4" y1="7.5" x2="20" y2="7.5" />
          <Line {...c} x1="4" y1="16.5" x2="20" y2="16.5" />
          <Circle {...c} fill={surface} cx="9.5" cy="7.5" r="2.4" />
          <Circle {...c} fill={surface} cx="15" cy="16.5" r="2.4" />
        </>
      );
    case "arrow-left":
      return (
        <>
          <Line {...c} x1="19" y1="12" x2="5" y2="12" />
          <Polyline {...c} points="11,6 5,12 11,18" />
        </>
      );
    case "arrow-up":
      return (
        <>
          <Line {...c} x1="12" y1="19" x2="12" y2="5" />
          <Polyline {...c} points="6,11 12,5 18,11" />
        </>
      );
    case "arrow-down":
      return (
        <>
          <Line {...c} x1="12" y1="5" x2="12" y2="19" />
          <Polyline {...c} points="6,13 12,19 18,13" />
        </>
      );
    case "chevron-right":
      return <Polyline {...c} points="9,5 16,12 9,19" />;
    case "close":
      return (
        <>
          <Line {...c} x1="6" y1="6" x2="18" y2="18" />
          <Line {...c} x1="18" y1="6" x2="6" y2="18" />
        </>
      );
    case "check":
      return <Polyline {...c} points="4.5,12.5 9.5,17.5 19.5,6.5" />;
    case "fish":
      return (
        <>
          <Path
            {...c}
            fill={fill}
            d="M2.8 12c2.4-3.6 5.8-5.4 9.4-5.4 3.3 0 6.2 1.6 8.2 4-.5.5-.9 1-.9 1.4s.4.9.9 1.4c-2 2.4-4.9 4-8.2 4-3.6 0-7-1.8-9.4-5.4Z"
          />
          <Circle fill={color} stroke="none" cx="15.6" cy="10.6" r="1" />
          <Path {...c} d="M7.6 8.4c.6 1.1.9 2.3.9 3.6s-.3 2.5-.9 3.6" />
        </>
      );
    case "hook":
      return (
        <>
          <Path {...c} d="M12 3.2v8.4a4.2 4.2 0 1 1-8.4 0" />
          <Line {...c} x1="12" y1="3.2" x2="12" y2="3.2" />
          <Circle fill={color} stroke="none" cx="12" cy="3.4" r="1.4" />
          <Path {...c} d="M15.6 6.8 12 3.2l3.6-.9" />
        </>
      );
    case "weight":
      return (
        <>
          <Path {...c} fill={fill} d="M5.6 8.4h12.8l1.8 11.4H3.8L5.6 8.4Z" />
          <Path {...c} d="M9.4 8.4a2.6 2.6 0 1 1 5.2 0" />
        </>
      );
    case "ruler":
      return (
        <>
          <Line {...c} x1="12" y1="3.5" x2="12" y2="20.5" />
          <Polyline {...c} points="8,7 12,3.5 16,7" />
          <Polyline {...c} points="8,17 12,20.5 16,17" />
        </>
      );
    case "ruler-h":
      return (
        <>
          <Line {...c} x1="3.5" y1="12" x2="20.5" y2="12" />
          <Polyline {...c} points="7,8 3.5,12 7,16" />
          <Polyline {...c} points="17,8 20.5,12 17,16" />
        </>
      );
    case "pin":
      return (
        <>
          <Path {...c} fill={fill} d="M12 21.2c4.2-4.6 6.3-7.8 6.3-10.5a6.3 6.3 0 1 0-12.6 0c0 2.7 2.1 5.9 6.3 10.5Z" />
          {/* Con el marcador relleno, el hueco interior se calca en el color
              de la superficie para que el círculo siga leyéndose. */}
          <Circle {...c} fill={fill === "none" ? "none" : surface} cx="12" cy="10.6" r="2.4" />
        </>
      );
    case "calendar":
      return (
        <>
          <Rect {...c} x="3.6" y="5.4" width="16.8" height="15" rx="2.4" />
          <Line {...c} x1="3.6" y1="10" x2="20.4" y2="10" />
          <Line {...c} x1="8.2" y1="3.4" x2="8.2" y2="7.2" />
          <Line {...c} x1="15.8" y1="3.4" x2="15.8" y2="7.2" />
        </>
      );
    case "clock":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="8.4" />
          <Polyline {...c} points="12,7.2 12,12 15.4,13.8" />
        </>
      );
    case "camera":
      return (
        <>
          <Path {...c} d="M3.4 8.6h3.4l1.6-2.6h7.2l1.6 2.6h3.4a1.4 1.4 0 0 1 1.4 1.4v8a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 18v-8a1.4 1.4 0 0 1 1.4-1.4Z" />
          <Circle {...c} cx="12" cy="13.6" r="3.4" />
        </>
      );
    case "gallery":
      return (
        <>
          <Rect {...c} x="3.4" y="4.8" width="17.2" height="14.4" rx="2.2" />
          <Circle {...c} cx="8.6" cy="9.6" r="1.6" />
          <Polyline {...c} points="4.2,17 9.6,12 13.4,15.4 16.4,12.8 20.4,16.4" />
        </>
      );
    case "flash":
      return <Path {...c} fill={fill} d="M13.4 2.6 5.2 13.4h5.4l-.8 8 8.2-10.8h-5.4l.8-8Z" />;
    case "flash-off":
      return (
        <>
          <Path {...c} d="M13.4 2.6 8.9 8.5m-1.5 2 -2.2 2.9h5.4l-.8 8 4.1-5.4" />
          <Line {...c} x1="3.6" y1="3.6" x2="20.4" y2="20.4" />
        </>
      );
    case "heart":
      return (
        <Path
          {...c}
          fill={fill}
          d="M12 20.3c-.4 0-.7-.1-1-.4l-6.6-6.2a5 5 0 0 1 7.6-6.5 5 5 0 0 1 7.6 6.5L13 19.9c-.3.3-.6.4-1 .4Z"
        />
      );
    case "comment":
      return (
        <Path
          {...c}
          d="M20.4 11.6c0 4.1-3.8 7.4-8.4 7.4-1 0-2-.2-2.9-.5l-5 1.5 1.6-4.4a6.9 6.9 0 0 1-2.1-4.9C3.6 7.5 7.4 4.2 12 4.2s8.4 3.3 8.4 7.4Z"
        />
      );
    case "share":
      return (
        <>
          <Circle {...c} cx="17.8" cy="5.8" r="2.8" />
          <Circle {...c} cx="6.2" cy="12" r="2.8" />
          <Circle {...c} cx="17.8" cy="18.2" r="2.8" />
          <Line {...c} x1="8.7" y1="10.7" x2="15.3" y2="7.1" />
          <Line {...c} x1="8.7" y1="13.3" x2="15.3" y2="16.9" />
        </>
      );
    case "more":
      return (
        <>
          <Circle fill={color} stroke="none" cx="5.4" cy="12" r="1.6" />
          <Circle fill={color} stroke="none" cx="12" cy="12" r="1.6" />
          <Circle fill={color} stroke="none" cx="18.6" cy="12" r="1.6" />
        </>
      );
    case "star":
      return (
        <Path
          {...c}
          fill={fill}
          d="m12 3.4 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3.4Z"
        />
      );
    case "crown":
      return (
        <>
          <Path {...c} fill={fill} d="M3.4 7.6 7 12l5-6.8L17 12l3.6-4.4-1.5 10.2H4.9L3.4 7.6Z" />
          <Line {...c} x1="4.9" y1="17.8" x2="19.1" y2="17.8" />
        </>
      );
    case "trophy":
      return (
        <>
          <Path {...c} fill={fill} d="M7.4 3.8h9.2v5.4a4.6 4.6 0 1 1-9.2 0V3.8Z" />
          <Path {...c} d="M7.4 5.6H4.6v1.8a3 3 0 0 0 2.8 3" />
          <Path {...c} d="M16.6 5.6h2.8v1.8a3 3 0 0 1-2.8 3" />
          <Line {...c} x1="12" y1="13.8" x2="12" y2="17.4" />
          <Line {...c} x1="8.2" y1="20.2" x2="15.8" y2="20.2" />
          <Path {...c} d="M9.6 20.2c0-1.5 1.1-2.8 2.4-2.8s2.4 1.3 2.4 2.8" />
        </>
      );
    case "medal":
      return (
        <>
          <Circle {...c} fill={fill} cx="12" cy="14.8" r="5.4" />
          <Polyline {...c} points="8.4,9.8 6,3.4 10,3.4 12,7.6" />
          <Polyline {...c} points="15.6,9.8 18,3.4 14,3.4 12,7.6" />
        </>
      );
    case "gem":
      return (
        <>
          <Path {...c} fill={fill} d="M7.2 3.8h9.6l4 5.6L12 20.4 3.2 9.4l4-5.6Z" />
          <Polyline {...c} points="3.2,9.4 20.8,9.4" />
          <Polyline {...c} points="9.4,9.4 12,20.4 14.6,9.4" />
        </>
      );
    case "eye":
      return (
        <>
          <Path {...c} d="M2.4 12c2.4-4 5.9-6 9.6-6s7.2 2 9.6 6c-2.4 4-5.9 6-9.6 6s-7.2-2-9.6-6Z" />
          <Circle {...c} cx="12" cy="12" r="3.1" />
        </>
      );
    case "chart":
      return (
        <>
          <Line {...c} x1="4" y1="20" x2="20" y2="20" />
          <Rect {...c} fill={fill} x="5.6" y="12" width="3.4" height="6" rx="1" />
          <Rect {...c} fill={fill} x="10.4" y="7.6" width="3.4" height="10.4" rx="1" />
          <Rect {...c} fill={fill} x="15.2" y="10" width="3.4" height="8" rx="1" />
        </>
      );
    case "flame":
      return (
        <Path
          {...c}
          fill={fill}
          d="M12 21c3.6 0 6.2-2.4 6.2-5.8 0-3.9-3.2-5.6-4.3-9.9-.1-.5-.7-.7-1.1-.4-2 1.5-3 3.4-3 5.6-1 0-1.9-.7-2.4-1.7-.2-.5-.9-.5-1.2 0a8.6 8.6 0 0 0-1.4 4.6C4.8 18.1 8 21 12 21Z"
        />
      );
    case "layers":
      return (
        <>
          <Path {...c} d="M12 3.4 3 8l9 4.6L21 8l-9-4.6Z" />
          <Polyline {...c} points="3,12.6 12,17.2 21,12.6" />
          <Polyline {...c} points="3,16.8 12,21.4 21,16.8" />
        </>
      );
    case "locate":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="3.2" />
          <Circle {...c} cx="12" cy="12" r="7.4" />
          <Line {...c} x1="12" y1="1.8" x2="12" y2="4.6" />
          <Line {...c} x1="12" y1="19.4" x2="12" y2="22.2" />
          <Line {...c} x1="1.8" y1="12" x2="4.6" y2="12" />
          <Line {...c} x1="19.4" y1="12" x2="22.2" y2="12" />
        </>
      );
    case "info":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="8.4" />
          <Line {...c} x1="12" y1="11" x2="12" y2="16.4" />
          <Circle fill={color} stroke="none" cx="12" cy="7.9" r="1.1" />
        </>
      );
    case "alert":
      return (
        <>
          <Path {...c} d="M12 3.8 21 19.6H3L12 3.8Z" />
          <Line {...c} x1="12" y1="9.6" x2="12" y2="14.2" />
          <Circle fill={color} stroke="none" cx="12" cy="16.9" r="1.1" />
        </>
      );
    case "help":
      return (
        <>
          <Circle {...c} cx="12" cy="12" r="8.4" />
          <Path {...c} d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.5" />
          <Circle fill={color} stroke="none" cx="12" cy="16.8" r="1.1" />
        </>
      );
    case "inbox":
      return (
        <>
          <Path {...c} d="M3.4 13.4h4.2l1.4 2.6h6l1.4-2.6h4.2" />
          <Path {...c} d="M5.6 5.2h12.8l2.2 8.2v4.2a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6v-4.2L5.6 5.2Z" />
        </>
      );
    case "swords":
      return (
        <>
          <Path {...c} d="M4 4h3.2l9 9-3.2 3.2-9-9V4Z" />
          <Path {...c} d="M20 4h-3.2l-3.4 3.4" />
          <Path {...c} d="m10.6 13.4-3.4 3.4" />
          <Line {...c} x1="4.6" y1="19.4" x2="7.6" y2="16.4" />
          <Line {...c} x1="19.4" y1="19.4" x2="16.4" y2="16.4" />
        </>
      );
    case "offline":
      return (
        <>
          <Path {...c} d="M2.6 9.4a14 14 0 0 1 5-3.2" />
          <Path {...c} d="M21.4 9.4a14 14 0 0 0-5.6-3.4" />
          <Path {...c} d="M6.2 13a9 9 0 0 1 2.6-1.8" />
          <Path {...c} d="M17.8 13a9 9 0 0 0-2.8-1.9" />
          <Path {...c} d="M9.6 16.4a4.4 4.4 0 0 1 4.8 0" />
          <Circle fill={color} stroke="none" cx="12" cy="19.6" r="1.3" />
          <Line {...c} x1="3.4" y1="3.4" x2="20.6" y2="20.6" />
        </>
      );
    case "lock":
      return (
        <>
          <Rect {...c} fill={fill} x="4.8" y="10.4" width="14.4" height="9.8" rx="2.2" />
          <Path {...c} d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
        </>
      );
    case "bell":
      return (
        <>
          <Path {...c} fill={fill} d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
          <Path {...c} d="M10 20.5a2.2 2.2 0 0 0 4 0" />
        </>
      );
    case "sun":
      return (
        <>
          <Circle {...c} fill={fill} cx="12" cy="12" r="4" />
          <Path {...c} d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </>
      );
    case "moon":
      return <Path {...c} fill={fill} d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6Z" />;
    case "wind":
      return (
        <>
          <Path {...c} d="M3 9h11.5a2.7 2.7 0 1 0-2.7-2.7" />
          <Path {...c} d="M3 13h15.5a2.7 2.7 0 1 1-2.7 2.7" />
          <Path {...c} d="M3 17h7" />
        </>
      );
    case "wave":
      return (
        <>
          <Path {...c} d="M2.5 10c2 0 2-1.8 4-1.8s2 1.8 4 1.8 2-1.8 4-1.8 2 1.8 4 1.8 2-1.8 3-1.8" />
          <Path {...c} d="M2.5 15.5c2 0 2-1.8 4-1.8s2 1.8 4 1.8 2-1.8 4-1.8 2 1.8 4 1.8 2-1.8 3-1.8" />
        </>
      );
    case "thermometer":
      return (
        <>
          <Path {...c} d="M10 13.6V5a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0Z" />
          <Circle fill={color} stroke="none" cx="12" cy="17" r="1.6" />
        </>
      );
    case "droplet":
      return <Path {...c} fill={fill} d="M12 3.2c3.6 4.4 5.6 7.6 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-2.8 2-6 5.6-10.4Z" />;
    case "edit":
      return (
        <>
          <Path {...c} d="M14.8 5.2 18.8 9.2 9 19H5v-4l9.8-9.8Z" />
          <Path {...c} d="m13 7 4 4" />
        </>
      );
    case "trash":
      return (
        <>
          <Path {...c} d="M4.5 7h15" />
          <Path {...c} d="M9.5 7V4.8h5V7" />
          <Path {...c} d="M6.5 7l.9 12.2h9.2L17.5 7" />
        </>
      );
    case "sparkle":
      return (
        <>
          <Path {...c} fill={fill} d="M11 3.5 12.8 9l5.7 1.9-5.7 1.9L11 18.5l-1.8-5.7-5.7-1.9L9.2 9 11 3.5Z" />
          <Path {...c} d="M18.5 3.5v3M17 5h3" />
        </>
      );
    case "grid":
      return (
        <>
          <Rect {...c} fill={fill} x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <Rect {...c} fill={fill} x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
          <Rect {...c} fill={fill} x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
          <Rect {...c} fill={fill} x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </>
      );
    case "list":
      return (
        <>
          <Line {...c} x1="9" y1="6.5" x2="20" y2="6.5" />
          <Line {...c} x1="9" y1="12" x2="20" y2="12" />
          <Line {...c} x1="9" y1="17.5" x2="20" y2="17.5" />
          <Circle fill={color} stroke="none" cx="5" cy="6.5" r="1.2" />
          <Circle fill={color} stroke="none" cx="5" cy="12" r="1.2" />
          <Circle fill={color} stroke="none" cx="5" cy="17.5" r="1.2" />
        </>
      );
    case "flag":
      return (
        <>
          <Line {...c} x1="5.5" y1="21" x2="5.5" y2="3.5" />
          <Path {...c} fill={fill} d="M5.5 4.5h11l-2.2 3.8 2.2 3.8h-11" />
        </>
      );
    default:
      return null;
  }
}
