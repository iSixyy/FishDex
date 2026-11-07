- Agregar una tipografia similar a la de Pokemon - PokeDex
- Agregar que cuando obtenga un logro la rareza esté centrado
- Modificiar la FishDex para que sea un diseño similar a la PokeDex y familiar 
### 17. 🟡 Notificaciones push
`expo-notifications` para avisar de solicitudes de amistad, récords
superados por un amigo, fin de temporada y misiones a punto de expirar.
**Toca:** `expo-notifications`, tabla `device_tokens`, `notification_service.py`.

### 18. 🟢 Compartir captura como imagen
Generar una tarjeta bonita (foto + especie + peso + rango + marca FishDex)
con `react-native-view-shot` y compartirla en WhatsApp/Instagram. Es el
canal de crecimiento más barato que existe.
**Toca:** nuevo `ShareCard.tsx`, `expo-sharing`.

### 11. 🟡 Mareas, clima y fase lunar por punto de pesca
Integrar una API gratuita (Open-Meteo, sin clave) para mostrar viento,
presión, temperatura del agua y mareas en el lugar de la captura y en los
puntos guardados. Muy valorado por pescadores reales.
**Toca:** `weather_service.py` (nuevo), tarjeta en mapa y en captura.

### 12. 🟡 Puntos de pesca guardados (spots privados)
Guardar spots con nombre, notas y fotos, privados por defecto, con opción
de compartirlos solo con amigos concretos. Respeta el principio actual de
no exponer coordenadas ajenas.
**Toca:** modelo `Spot`, rutas `/spots`, pantalla en mapa.

### 13. 🟡 Regulación legal ampliada y avisos de veda
La tabla `regulations` ya existe con fuente citada. Ampliarla a todas las
comunidades y avisar en el momento de registrar: "esta especie está en veda
en Galicia hasta el 15/03" o "talla mínima 25 cm".
**Toca:** `regulations_seed.py`, aviso en `catch/create.tsx`.

### 8. 🟡 Torneos y retos entre amigos
Reto 1v1 o grupal con duración y criterio ("quien pesque la pieza más
pesada esta semana"). Se apoya en el sistema de amigos ya implementado.
**Toca:** modelo `Challenge`, rutas `/challenges`, pantalla nueva.
Esto será únicamente cuando el usuario agrega a la persona y dicha persona
acepta el reto, al visitar su perfil tendremos un apartado que dira retar
cuando se acepte dicho reto nos saldrá dicho reto o dicho torneo si es con
multiples amigos, para poder crear un torneo entre amigos saldrá un botón 
también que dirá Torneo, evidentemente existiran eventos hosteados por la 
administración que esos son notificados para todos los usuarios.

### 9. 🟡 Ranking global y por comunidad autónoma
Hoy el ranking es solo de amigos. Añadir leaderboard global, por comunidad
y por especie (récord de peso por especie), con paginación.
**Toca:** `GET /ranking/global`, `/ranking/region/{code}`, `ranking/index.tsx`.

### 10. 🟡 Sistema de logros ampliado + insignias visibles
De 9 logros a ~40, con niveles (bronce/plata/oro) y vitrina de insignias en
el perfil, visible para amigos.
**Toca:** `achievements_seed.py`, `achievement_service.py`, `profile/`.

### 3. 🟢 Editar y borrar una captura
Hoy una captura es inmutable. Permitir corregir peso/longitud/especie
(recalculando ELO en servidor) y eliminar una captura errónea.
**Toca:** `PATCH/DELETE /captures/{id}`, `capture_service.py`, `elo_service.py`.

### 5. 🟢 Modo oscuro / claro configurable
La app es dark-only. Extraer `constants/theme.ts` a un `ThemeContext` con
preferencia persistida y opción "seguir al sistema".
**Toca:** `src/constants/theme.ts`, nuevo `src/context/ThemeContext.tsx`.

### 1. 🟢 Identificación de especie por foto (IA local)
Enchufar un modelo de visión (Ollama `llava` o `moondream`) en
`ai_service.py` para sugerir la especie al subir la foto, con confianza y
confirmación manual. La arquitectura ya está preparada: el flujo separa
"elegir especie" de "subir foto".
**Toca:** `backend/app/services/ai_service.py`, `app/catch/create.tsx`.

