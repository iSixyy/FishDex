"""Configuración del "juego": ELO, rangos y reglas anti-farmeo.

Todo lo numérico vive aquí (no en la UI ni hardcodeado en rutas) para que
pueda ajustarse desde un único sitio y exponerse a través de `/config`.
"""
from enum import Enum
from typing import TypedDict


class Rarity(str, Enum):
    COMMON = "COMMON"
    UNCOMMON = "UNCOMMON"
    RARE = "RARE"
    EPIC = "EPIC"
    LEGENDARY = "LEGENDARY"
    MYTHIC = "MYTHIC"


# ELO base otorgado la PRIMERA vez que se desbloquea una especie de cada rareza.
RARITY_BASE_ELO: dict[Rarity, int] = {
    Rarity.COMMON: 10,
    Rarity.UNCOMMON: 20,
    Rarity.RARE: 35,
    Rarity.EPIC: 55,
    Rarity.LEGENDARY: 80,
    Rarity.MYTHIC: 120,
}

# Nombre visible y color asociado a cada rareza (dark mode).
RARITY_META: dict[Rarity, dict] = {
    Rarity.COMMON: {"label": "Común", "color": "#9CA3AF"},
    Rarity.UNCOMMON: {"label": "Poco común", "color": "#4ADE80"},
    Rarity.RARE: {"label": "Raro", "color": "#38BDF8"},
    Rarity.EPIC: {"label": "Épico", "color": "#A78BFA"},
    Rarity.LEGENDARY: {"label": "Legendario", "color": "#FBBF24"},
    Rarity.MYTHIC: {"label": "Mítico", "color": "#F87171"},
}

# --- Anti-farmeo ---
# Capturas repetidas de una especie YA descubierta otorgan solo una fracción
# del ELO base, para evitar farmear ELO repitiendo la misma especie.
REPEAT_CAPTURE_ELO_RATIO = 0.10
REPEAT_CAPTURE_ELO_MIN = 2

# Bonus fijos (se suman al ELO calculado de la captura).
PERSONAL_RECORD_BONUS_ELO = 25
# Captura y suelta: devolver el pez al agua suma algo de ELO (no cuenta si la
# captura ya no da ELO por el límite diario anti-farmeo).
RELEASE_BONUS_ELO = 5
EXCEPTIONAL_SIZE_BONUS_ELO = 15  # cuando peso o longitud superan claramente la media de la especie
EXCEPTIONAL_SIZE_THRESHOLD_RATIO = 0.9  # % del máximo habitual de la especie para considerarse "excepcional"

# Límite diario de capturas que otorgan ELO por la MISMA especie (0 = sin límite).
MAX_ELO_REWARDING_CAPTURES_PER_SPECIES_PER_DAY = 3

# Antigüedad máxima admitida en `captured_at`. Evita que un cliente retroceda la
# fecha arbitrariamente, pero debe ser HOLGADA respecto a la cola de sincronización
# offline: una captura registrada sin conexión puede tardar días en subirse y, si
# se rechazara, el móvil la reintentaría en bucle o la descartaría. Mantener este
# valor por encima de `jwt_expire_minutes` (7 días) para que el token caduque antes
# que la propia captura.
MAX_CAPTURED_AT_AGE_DAYS = 30


class RankKey(str, Enum):
    ALEVIN = "ALEVIN"
    PESCADOR = "PESCADOR"
    PESCADOR_EXPERTO = "PESCADOR_EXPERTO"
    MAESTRO = "MAESTRO"
    CAPITAN = "CAPITAN"
    LEYENDA = "LEYENDA"


class RankDef(TypedDict):
    """Estructura tipada de cada rango, para no depender de accesos frágiles
    como `r["key"].value` en quien la consuma: `key` ya es un `str` plano."""

    key: str
    name: str
    icon: str
    min_elo: int
    max_elo: int | None
    description: str


# Los 6 rangos competitivos. min_elo inclusive, max_elo exclusive (None = sin techo).
RANKS: list[RankDef] = [
    {"key": RankKey.ALEVIN.value, "name": "Alevín", "icon": "🥉", "min_elo": 0, "max_elo": 500,
     "description": "Acabas de estrenar la caña. Todo empieza aquí."},
    {"key": RankKey.PESCADOR.value, "name": "Pescador", "icon": "🥉", "min_elo": 500, "max_elo": 1000,
     "description": "Ya sabes distinguir un sedal de una prisa."},
    {"key": RankKey.PESCADOR_EXPERTO.value, "name": "Pescador Experto", "icon": "🥈", "min_elo": 1000, "max_elo": 1500,
     "description": "Los peces empiezan a conocerte por el nombre."},
    {"key": RankKey.MAESTRO.value, "name": "Maestro", "icon": "🥈", "min_elo": 1500, "max_elo": 2200,
     "description": "Tu FishDex empieza a dar envidia."},
    {"key": RankKey.CAPITAN.value, "name": "Capitán", "icon": "🥇", "min_elo": 2200, "max_elo": 3000,
     "description": "Mandas en el agua y lo sabes."},
    {"key": RankKey.LEYENDA.value, "name": "Leyenda", "icon": "👑", "min_elo": 3000, "max_elo": None,
     "description": "Se cuentan batallitas sobre ti en los bares de puerto."},
]


def get_rank_for_elo(elo: int) -> RankDef:
    elo = max(elo, 0)  # un ELO negativo (no debería ocurrir, pero por si acaso) cuenta como el mínimo
    for rank in RANKS:
        if elo >= rank["min_elo"] and (rank["max_elo"] is None or elo < rank["max_elo"]):
            return rank
    return RANKS[0]  # fallback al rango más bajo, nunca al más alto


# --- Logros: umbrales configurables ---
ACHIEVEMENT_SPECIES_MILESTONES = [10, 50]
ACHIEVEMENT_WEIGHT_KG_THRESHOLD = 5.0
ACHIEVEMENT_LENGTH_CM_THRESHOLD = 100.0
ACHIEVEMENT_REGIONS_THRESHOLD = 3


# --- Rareza a partir de la dificultad de captura (IA) ---
# La IA puntúa de 1 (se pesca en cualquier puerto) a 10 (casi imposible).
# La rareza se calcula UNA VEZ al dar de alta la especie y queda guardada en
# ella: es una propiedad de la especie, igual para todos los usuarios.
CATCH_DIFFICULTY_RARITY: list[tuple[int, Rarity]] = [
    (3, Rarity.COMMON),
    (5, Rarity.UNCOMMON),
    (7, Rarity.RARE),
    (8, Rarity.EPIC),
    (9, Rarity.LEGENDARY),
    (10, Rarity.MYTHIC),
]


def rarity_for_catch_difficulty(difficulty: int) -> Rarity:
    difficulty = min(max(int(difficulty), 1), 10)
    for max_difficulty, rarity in CATCH_DIFFICULTY_RARITY:
        if difficulty <= max_difficulty:
            return rarity
    return Rarity.MYTHIC


# Confianza mínima (0-1) de la IA para dar de alta una especie NUEVA en el
# catálogo compartido. Por debajo, solo se sugiere si ya existe.
AI_MIN_CONFIDENCE_TO_CREATE_SPECIES = 0.75

# Techo de rareza para las especies que da de alta la IA. La dificultad la
# puntúa el propio modelo a partir de una foto que sube cualquier usuario: sin
# techo, bastaba con fotos "difíciles" para crear especies MÍTICAS (120 ELO
# cada una) y farmear ELO y logros. Un administrador puede subirla a mano.
AI_SPECIES_MAX_RARITY = Rarity.RARE

# Especies nuevas que un mismo usuario puede añadir al catálogo común por día.
AI_MAX_NEW_SPECIES_PER_USER_PER_DAY = 3


def cap_rarity(rarity: Rarity, ceiling: Rarity) -> Rarity:
    """Devuelve `rarity` sin superar `ceiling` (según el orden de `Rarity`)."""
    order = list(Rarity)
    return order[min(order.index(rarity), order.index(ceiling))]


# --- Plausibilidad de las medidas ---
# Una captura no puede superar este múltiplo del máximo habitual de su especie.
# Holgado a propósito (los récords reales superan el "máximo habitual"), pero
# impide registrar una trucha de 500 kg para ganar retos, rankings y logros.
MAX_PLAUSIBLE_WEIGHT_FACTOR = 3.0
MAX_PLAUSIBLE_LENGTH_FACTOR = 1.6

# Zona horaria del "día de pesca" (límite diario anti-farmeo, normativa).
GAME_TIMEZONE = "Europe/Madrid"

# La instantánea de clima/mar se toma de las condiciones ACTUALES: solo tiene
# sentido si la captura es reciente. Una captura offline que se sube días
# después no debe guardar el tiempo del momento de la sincronización.
WEATHER_SNAPSHOT_MAX_AGE_HOURS = 3
