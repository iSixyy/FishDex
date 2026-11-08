import { Alert as NativeAlert, AlertButton, AlertOptions, Platform } from "react-native";

/** `Alert.alert` de react-native-web es una función vacía: en la versión de
 * navegador (`python run.py --web` / `--render`) no se mostraba ningún aviso
 * ni error, y las confirmaciones (borrar captura, borrar spot, cerrar
 * sesión...) nunca llegaban a ejecutar su acción. Este sustituto mantiene la
 * misma firma y en web usa los diálogos del navegador:
 *  - sin botones o con uno: `window.alert` y se ejecuta ese botón;
 *  - con "cancelar" + una acción: `window.confirm`;
 *  - con varias acciones (p. ej. "Cámara" / "Galería"): se pregunta una a una. */
function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === "cancel");
  const actions = list.filter((b) => b !== cancel);

  if (actions.length === 0) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  if (actions.length === 1 && !cancel) {
    window.alert(text);
    actions[0].onPress?.();
    return;
  }
  for (const action of actions) {
    const question = actions.length === 1 ? text : `${text}\n\n¿${action.text ?? "Aceptar"}?`;
    if (window.confirm(question)) {
      action.onPress?.();
      return;
    }
  }
  cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      webAlert(title, message, buttons);
      return;
    }
    NativeAlert.alert(title, message, buttons, options);
  },
};
