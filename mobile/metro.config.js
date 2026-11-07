const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// react-native-maps no tiene versión web: en el navegador se sustituye por un
// marcador de posición. Android e iOS siguen usando la librería real.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return { type: "sourceFile", filePath: path.resolve(__dirname, "src/web/react-native-maps.tsx") };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
