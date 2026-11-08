// Extiende app.json con valores que no deben ir en el repositorio.
//
// react-native-maps en Android usa SIEMPRE el SDK de Google Maps (el
// `UrlTile` de OpenStreetMap es solo una capa encima), y ese SDK exige una
// API key en el AndroidManifest: sin ella la app se cierra al abrir el Mapa,
// la ficha de una especie o el paso de ubicación de una captura. Expo Go
// trae su propia key, por eso allí sí funcionaba; en `expo run:android` o
// en un build de EAS no.
//
// Define GOOGLE_MAPS_API_KEY (en mobile/.env o en el entorno de EAS) y
// regenera el proyecto nativo con `npx expo prebuild --platform android`.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  // En la preview web (`python run.py --render`) no hay mapas nativos: sin aviso.
  if (!googleMapsApiKey && !process.env.FISHDEX_WEB_PREVIEW) {
    console.warn(
      "[app.config] GOOGLE_MAPS_API_KEY no está definida: los mapas fallarán en builds nativos de Android (en Expo Go sí funcionan)."
    );
  }

  // URL del backend. Antes el perfil `production` de eas.json no la definía
  // y la app publicada acababa apuntando a http://10.0.2.2:8000 (el localhost
  // del EMULADOR): en un móvil real no conectaba nunca. Ahora un build de
  // producción sin una URL https se para aquí con un error claro.
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl;
  if (process.env.EAS_BUILD_PROFILE === "production" && !(process.env.EXPO_PUBLIC_API_URL || "").startsWith("https://")) {
    throw new Error(
      "[app.config] El build de producción necesita EXPO_PUBLIC_API_URL con la URL https del backend " +
        "(defínela en el `env` del perfil production de eas.json o en las variables de entorno de EAS)."
    );
  }
  // Android bloquea el tráfico HTTP sin TLS en builds release (los APK del
  // perfil `preview` incluidos): con un backend http:// (IP local, emulador)
  // todas las peticiones fallaban. Solo se permite cuando la URL es http.
  const usesCleartextTraffic = !apiUrl || apiUrl.startsWith("http://");

  // Las notificaciones push de Expo necesitan el id del proyecto de EAS
  // (`eas init` lo crea). Sin él `getExpoPushTokenAsync` no puede funcionar y
  // nunca se registraba ningún dispositivo. Se lee de EAS_PROJECT_ID.
  const easProjectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey ? { config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } } } : {}),
    },
    plugins: [...(config.plugins ?? []), ["expo-build-properties", { android: { usesCleartextTraffic } }]],
    extra: {
      ...config.extra,
      apiUrl,
      ...(easProjectId ? { eas: { ...config.extra?.eas, projectId: easProjectId } } : {}),
    },
  };
};
