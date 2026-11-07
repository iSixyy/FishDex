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
  return {
    ...config,
    android: {
      ...config.android,
      ...(googleMapsApiKey ? { config: { ...config.android?.config, googleMaps: { apiKey: googleMapsApiKey } } } : {}),
    },
  };
};
