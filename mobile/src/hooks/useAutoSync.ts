import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";

import { queueLength, trySyncQueue } from "@/services/syncQueue";

/** Sincroniza automáticamente la cola de capturas offline en cuanto vuelve
 * la conexión a internet: Local DB -> Sync Queue -> Backend (Fase 9). */
export function useAutoSync(): void {
  useEffect(() => {
    // Empieza en `false` para que el primer evento de NetInfo (que llega nada
    // más suscribirse) cuente como "conexión recuperada": con `true`, una cola
    // que venía de una sesión anterior no se subía al abrir la app con red,
    // solo tras perder y recuperar la conexión.
    let wasConnected = false;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected && !!state.isInternetReachable;
      if (isConnected && !wasConnected) {
        queueLength()
          .then((length) => {
            if (length > 0) trySyncQueue().catch(() => undefined);
          })
          .catch(() => undefined);
      }
      wasConnected = isConnected;
    });

    return unsubscribe;
  }, []);
}
