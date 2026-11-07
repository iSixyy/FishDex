import { router, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";

/** Esta pestaña nunca se muestra de verdad: el listener de la tab la
 * intercepta y abre el modal de captura. Este fallback cubre el caso de
 * que se llegue aquí por navegación directa (deep link, back, etc). */
export default function CatchTabFallback() {
  useFocusEffect(
    useCallback(() => {
      router.replace("/(tabs)/home");
      router.push("/catch/create");
    }, [])
  );

  return <LoadingScreen message="Abriendo cámara..." />;
}
