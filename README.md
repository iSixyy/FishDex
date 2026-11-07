# 🐟 FishDex

**La Pokédex para pescadores en España.** Registra tus capturas, desbloquea
especies, compite por ELO con tus amigos y visualiza tus pescas en un mapa —
todo con datos reales, backend propio y app instalable en Android.

Este es un **MVP real y funcional**: registro/login, base de datos SQLite,
cámara, GPS, mapa, ELO calculado en servidor, sistema de amigos y una IA
local opcional (Ollama) para las frases de celebración. Todo se ejecuta en
local con herramientas gratuitas.

---

## 0. Estructura del proyecto

```text
fishdex/
├── backend/               API en FastAPI + SQLite
├── mobile/                App en React Native (Expo) + TypeScript
├── EMULADOR_ANDROID.md    Guía paso a paso para probar en el emulador
└── FEATURES.md            Backlog de features candidatas
```

> 🚀 **¿Solo quieres probarlo en el emulador de Android?**
> Ve directo a [`EMULADOR_ANDROID.md`](EMULADOR_ANDROID.md): las dependencias
> ya están instaladas y la base de datos poblada.

Cada carpeta tiene su propio `.env.example`. El backend y el frontend están
totalmente desacoplados: se comunican solo por HTTP.

---

## 1. Requisitos

Necesitas instalar, en tu PC (Windows, macOS o Linux):

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS o superior | Ejecutar Expo / la app |
| [Python](https://www.python.org/downloads/) | 3.11 – 3.14 | Ejecutar el backend |
| [Git](https://git-scm.com/) | cualquiera | Clonar/gestionar el proyecto |
| Un móvil Android **o** un emulador Android | — | Probar la app |
| [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) (opcional) | — | Probar sin generar APK |
| [Ollama](https://ollama.com/download) (opcional) | — | Frases de celebración generadas por IA local |

No necesitas ninguna cuenta de pago. EAS Build (para el APK) tiene un plan
gratuito suficiente para este MVP.

### 2. Instalar Node

Descarga el instalador LTS desde https://nodejs.org/ y ejecútalo. Verifica:

```bash
node --version
npm --version
```

### 3. Instalar Python

Descarga desde https://www.python.org/downloads/ (marca "Add Python to
PATH" durante la instalación en Windows). Verifica:

```bash
python --version   # o python3 --version
pip --version
```

---

## 4. Instalar dependencias

### Backend

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

### Frontend

```bash
cd mobile
npm install
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

Edita `mobile/.env` y ajusta `EXPO_PUBLIC_API_URL` (ver sección 8).

---

## 5. Ejecutar el backend

```bash
cd backend
venv\Scripts\activate        # o: source venv/bin/activate

# 1) Poblar la base de datos con especies, ubicaciones, logros y frases:
python -m app.seed.seed_data

# 2) Arrancar el servidor:
python run.py
```

El backend queda escuchando en `http://localhost:8000`. Abre
`http://localhost:8000/docs` para ver la documentación interactiva
(Swagger) generada automáticamente por FastAPI.

Para ejecutar los tests del backend:

```bash
python -m pytest
```

---

## 6. Ejecutar Expo

En otra terminal:

```bash
cd mobile
npx expo start
```

Se abrirá el Metro Bundler con un código QR. Tienes tres formas de probarlo:

- **Expo Go** (más rápido, sin compilar nada): escanea el QR con la app
  Expo Go en tu móvil Android.
- **Emulador Android** (Android Studio): pulsa `a` en la terminal de Expo,
  o directamente `npm run emulator`. Guía completa en
  [`EMULADOR_ANDROID.md`](EMULADOR_ANDROID.md).
- **APK instalado** (ver sección 9): abre la app FishDex directamente en tu
  móvil, ya lleva el bundle de JS incluido si generaste un build de
  producción, o se conecta al Metro Bundler si es un build de desarrollo.

Scripts disponibles en `mobile/`:

| Script | Qué hace |
|---|---|
| `npm start` | Arranca Metro con el QR |
| `npm run emulator` | Arranca Metro y abre la app en el emulador Android |
| `npm run emulator:clean` | Igual, limpiando la caché de Metro |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run doctor` | Diagnostica problemas de dependencias de Expo |

---

## 7. Ejecutar Ollama (opcional)

La app **funciona perfectamente sin Ollama**: si no está disponible, las
frases de celebración se toman de una base local de más de 100 frases
originales. Si quieres frases generadas dinámicamente por IA:

```bash
# Instala Ollama desde https://ollama.com/download y luego:
ollama pull llama3.2
ollama serve
```

Por defecto el backend busca Ollama en `http://localhost:11434` con el
modelo `llama3.2` (configurable en `backend/.env`: `OLLAMA_HOST`,
`OLLAMA_MODEL`, `OLLAMA_ENABLED`).

---

## 8. Ejecutar en un móvil físico

El móvil y el PC deben estar en la **misma red WiFi**.

1. Averigua la IP local de tu PC:
   - Windows: `ipconfig` → busca "Dirección IPv4" (algo como `192.168.1.35`)
   - macOS/Linux: `ifconfig` o `ip a`
2. Edita `mobile/.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.35:8000
   ```
3. Reinicia `npx expo start` (o el APK si ya está instalado).
4. Asegúrate de que el backend (`python run.py`) sigue corriendo en el PC.

> En el **emulador de Android** en el mismo PC, `10.0.2.2` apunta al
> `localhost` del PC — por eso ese es el valor por defecto en
> `.env.example`. Para un móvil físico **siempre** tienes que usar la IP
> real del PC, no `10.0.2.2` ni `localhost`.

---

## 9. Generar el APK

### Opción A — Build local con `prebuild` (100% gratis, sin cuenta)

```bash
cd mobile
npx expo prebuild --platform android
npx expo run:android
```

Esto genera la carpeta nativa `android/` y compila + instala la app
directamente en un emulador o móvil conectado por USB con la depuración
USB activada. Requiere tener instalado el Android SDK (se instala junto
con [Android Studio](https://developer.android.com/studio)).

Para generar un `.apk` instalable manualmente (sin conectar el móvil):

```bash
cd mobile/android
./gradlew assembleRelease        # macOS/Linux
gradlew.bat assembleRelease      # Windows
```

El APK queda en `android/app/build/outputs/apk/release/app-release.apk`.
Cópialo al móvil (por cable, Drive, etc.) e instálalo (activa "Instalar
apps de origen desconocido" si Android lo pide).

### Opción B — EAS Build (build en la nube de Expo, gratis)

No requiere Android Studio ni SDK instalado localmente.

```bash
npm install -g eas-cli
cd mobile
eas login          # crea una cuenta gratuita en expo.dev si no tienes
eas build --platform android --profile preview
```

Al terminar, la terminal te da un enlace de descarga del `FishDex.apk`
(también aparece en tu panel de https://expo.dev). Descárgalo en el móvil
e instálalo.

> El perfil `preview` (en `mobile/eas.json`) genera un `.apk` normal
> (no un `.aab`, que es solo para subir a Google Play) y apunta al backend
> definido en `EXPO_PUBLIC_API_URL` dentro de ese mismo perfil — edítalo
> con la IP de tu PC (o la de un servidor donde despliegues el backend) si
> vas a probar el APK sin Metro Bundler corriendo.

```text
Código
   ↓
Expo (prebuild / EAS Build)
   ↓
Android APK
   ↓
Móvil físico
   ↓
Pruebas
```

---

## Funcionalidades implementadas

- **Auth**: registro/login con contraseña hasheada (bcrypt) y JWT, con rate
  limiting en los endpoints de autenticación y cierre de sesión automático
  cuando el token caduca.
- **FishDex**: grid tipo Pokédex con número de especie, foto real, rareza y
  progreso; especies no descubiertas aparecen bloqueadas.
- **Ficha de cada pez**: foto real de tu captura + datos de la especie +
  regulación legal (talla mínima estatal/autonómica) — nunca se inventa un
  dato legal: si no hay fuente verificada, se muestra "Información no
  disponible".
- **Nueva captura**: foto (cámara o galería, comprimida automáticamente),
  selección de especie, peso, longitud, fecha/hora automáticas, GPS
  opcional. El ELO, la rareza y los récords se calculan **siempre en el
  servidor** — el cliente nunca puede inyectar ELO.
- **Celebración**: modal con animación/haptics, frase de humor español
  (110 frases originales, +Ollama opcional), ELO ganado y logros
  desbloqueados.
- **ELO y 6 rangos**: Alevín, Pescador, Pescador Experto, Maestro, Capitán,
  Leyenda — todo configurable desde `backend/app/core/game_config.py` y
  expuesto vía `GET /config` (nunca hardcodeado en la UI).
- **Anti-farmeo**: las capturas repetidas de una especie ya desbloqueada
  dan mucho menos ELO, con un límite diario configurable.
- **Amigos**: solicitudes, aceptar/rechazar, ver FishDex de un amigo,
  comparación 1 a 1, ranking de amigos.
- **Mapa**: capturas propias sobre OpenStreetMap (sin API de pago); la
  ubicación exacta nunca se comparte con otros usuarios — la FishDex
  pública solo muestra el nombre aproximado del lugar.
- **Logros**: 9 logros iniciales (primera captura, hitos de especies,
  primera rara/épica/legendaria, peso/longitud destacados, 3 comunidades
  autónomas).
- **Offline**: la FishDex y las capturas se cachean localmente; una
  captura sin conexión se guarda en una cola local y se sincroniza sola en
  cuanto vuelve la conexión (el ELO se calcula al sincronizar, nunca antes).
  La foto se copia a almacenamiento persistente para que el sistema no la
  borre mientras espera, y una captura rechazada de forma definitiva por el
  servidor se aparta en vez de reintentarse en bucle.
- **España**: español de España, kg/cm, fechas DD/MM/AAAA, hora 24h,
  comunidades autónomas/provincias/ríos/embalses/costas en el catálogo de
  ubicaciones.

## Tests

```bash
cd backend
python -m pytest -v
```

Cubren: registro, login, hashing de contraseñas, creación de capturas,
cálculo de ELO (especie nueva, repetida, récord, bonus por tamaño,
límite diario anti-farmeo), rangos, desbloqueo de especies en la FishDex,
regulaciones ("información no disponible" cuando no hay dato verificado),
solicitudes de amistad, permisos (no puedes ver la FishDex de quien no es
tu amigo), y validación de datos de entrada.

## Notas sobre datos legales

Los datos de talla mínima/veda por especie viven en una tabla `regulations`
separada de la biología de la especie, y solo se rellenan cuando hay una
fuente oficial razonablemente verificable (se cita en `source`). El resto
de especies del seed **no** llevan regulación inventada — verifica siempre
los datos reales con las fuentes oficiales (MAPA y las Consejerías
autonómicas) antes de usar esta app con fines reales de pesca.

## Arquitectura pensada para crecer

- **DB**: SQLite ahora; cambiar a PostgreSQL en el futuro es solo cambiar
  `DATABASE_URL` en `backend/.env` (el código usa SQLAlchemy estándar).
- **IA**: toda pasa por `backend/app/services/ai_service.py`; cambiar de
  modelo o de motor de IA no toca el resto de la app.
- **Identificación de especie por foto**: el flujo de captura ya separa
  "elegir especie" de "subir foto", listo para enchufar un modelo de
  visión más adelante sin rehacer la pantalla.
- **Sync offline**: `mobile/src/services/syncQueue.ts` ya implementa el
  patrón *Local DB → Sync Queue → Backend* con reintento automático.
