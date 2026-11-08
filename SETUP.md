# 🎣 FishDex — Puesta en marcha

Todo está instalado y configurado. Para arrancar solo necesitas **dos
terminales**: una para el backend y otra para la app.

---

## 1. Backend

```powershell
cd C:\Users\Administrator\Desktop\-\fishdex\backend
.\venv\Scripts\activate
python run.py
```

Déjala abierta. Queda escuchando en `http://localhost:8000`.
Para comprobarlo: http://localhost:8000/docs

---

## 2. App en el emulador

Abre el **emulador Pixel 7** desde Android Studio y espera a que arranque.
Luego, en **otra** terminal:

```powershell
cd C:\Users\Administrator\Desktop\-\fishdex\mobile
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:ANDROID_HOME = "F:\AndroidData"
$env:GRADLE_USER_HOME = "F:\gradle-home"
npx expo run:android
```

> Las tres variables importan: Android Studio trae Java 25 y React Native
> necesita el 17; el SDK está en `F:\AndroidData`; y la caché de Gradle va a
> F: para no llenar C:.

La **primera vez tarda bastante** (compila el proyecto nativo entero). Las
siguientes son casi instantáneas: basta con `npx expo start` y pulsar `a`.

---

## 3. Entrar en la app

| Campo | Valor |
|---|---|
| Email | `admin@fishdex.es` |
| Contraseña | `admin` |

> El login pide **email**, no nombre de usuario.

---

## Comandos útiles

| Comando | Para qué |
|---|---|
| `npx expo start` | Arranca solo Metro (si la app ya está instalada) |
| `npx expo start --clear` | Igual, limpiando la caché de Metro |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `python -m pytest` | Tests del backend (desde `backend/` con el venv activo) |
| `python -m app.seed.seed_data` | Repuebla la base de datos si la borras |

---

## Si algo falla

| Síntoma | Solución |
|---|---|
| "No se ha podido conectar con el servidor" | El backend no está corriendo, o paraste su terminal. Vuelve al paso 1. |
| Expo no encuentra el emulador | Ábrelo desde Android Studio y espera a la pantalla de inicio. |
| Cambié `mobile/.env` y no se entera | Metro cachea las variables: reinicia con `npx expo start --clear`. |
| Pantalla roja de error JS | La terminal de Metro te dice el archivo y la línea. |
| Gradle falla por espacio en disco | La caché va a `F:\gradle-home`. Si F: se llena, bórrala: se regenera sola. |

---

## Cómo se conectan las piezas

```text
Emulador Android                    Tu PC
┌──────────────────┐               ┌─────────────────────┐
│  App FishDex     │──────────────▶│  Backend FastAPI    │
│                  │  10.0.2.2:8000│  localhost:8000     │
└──────────────────┘               └─────────────────────┘
```

`10.0.2.2` es la dirección con la que el emulador de Android Studio ve el
`localhost` de tu PC. Está configurada en `mobile/.env` y por eso no hace
falta tocar el firewall.

Para un **móvil físico** en la misma WiFi, cambia esa línea por la IP local
del PC (`http://192.168.1.135:8000`) y reinicia Metro con `--clear`.

## Publicar la app (builds de EAS y servidor)

**App (EAS).** El perfil `production` necesita la URL **https** del backend;
si falta, `app.config.js` para el build con un error en vez de publicar una
app que apunta al emulador:

| Variable (en el `env` del perfil de `eas.json` o en EAS) | Para qué |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL del backend. Obligatoria y `https://` en `production`. |
| `EAS_PROJECT_ID` | Id del proyecto de EAS (`eas init`). Sin él no hay notificaciones push. |
| `GOOGLE_MAPS_API_KEY` | Mapas en builds nativos de Android. |

Con una URL `http://` (perfiles de desarrollo y `preview`) se permite el
tráfico HTTP sin TLS en Android; con `https://` se bloquea.

**Backend (`backend/.env`).**

| Variable | Para qué |
|---|---|
| `ENVIRONMENT=production` + `JWT_SECRET_KEY` | Clave real de al menos 32 caracteres. |
| `ADMIN_USERNAMES` | Usuarios administradores. Registra esos nombres tú antes de abrir la app al público. |
| `TRUST_PROXY_HEADERS=true` | Solo detrás de un proxy inverso que sobrescriba `X-Forwarded-For`: el rate limit usa la IP real del cliente. |

Se puede arrancar con varios workers de uvicorn: la tarea periódica de
retos corre en cada uno, pero el cierre de retos y los avisos son atómicos y
no se duplican.

## Probar la app en el navegador (modo demo)

Un solo comando levanta la API **y** la app en el navegador (Metro), y abre el
navegador cuando la app está lista. Hay dos modos, según con qué datos quieras probar:

```bash
cd backend
.\venv\Scripts\activate
python run.py --web             # TUS datos: fishdex.db y tus cuentas de siempre
python run.py --render          # DEMO: BD aparte con usuarios y capturas de ejemplo
```

- Al arrancar se muestra qué base de datos se está usando. Si el login da
  `401 Unauthorized`, casi siempre es que esa cuenta no existe en ESA base de
  datos (p.ej. tu cuenta real con `--render`, o `samuel@demo.es` con `--web`).
- `--render` usa una BD aparte (`backend/demo/`): nunca toca `fishdex.db`.
- `--reset` regenera la demo desde cero · `--no-web` solo la API ·
  `--no-browser` no abre el navegador · `--web-port 8082` cambia el puerto de Metro.
- Ctrl+C lo para todo (API y Metro).
- Si prefieres dos terminales: `python run.py` (o `--render --no-web`) y, aparte, `cd mobile && npm run web`.

Usuario de demo: `samuel@demo.es` / `demo12345` (tiene amigos, capturas, un reto
en curso, una invitación pendiente y un spot; además puede crear eventos oficiales).

En el navegador el mapa aparece como un recuadro (react-native-maps no existe en
web), y la cámara, el GPS y las notificaciones dependen de lo que permita el
navegador. Para el resto, la app es la misma que en el móvil.
