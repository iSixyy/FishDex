"""Catálogo de logros: 14 familias x 3 niveles (bronce/plata/oro) + la
primera captura = 43 logros.

Cada logro se desbloquea cuando una MÉTRICA del usuario alcanza su umbral
(ver `achievement_service._compute_metrics`). Los códigos de la versión
anterior (FIRST_CATCH, SPECIES_10, HEAVY_5KG...) se conservan tal cual para
que ningún usuario pierda lo que ya había desbloqueado.
"""
from typing import TypedDict


class Tier:
    BRONZE = "BRONZE"
    SILVER = "SILVER"
    GOLD = "GOLD"


TIER_ORDER = {Tier.GOLD: 3, Tier.SILVER: 2, Tier.BRONZE: 1, None: 0}


class AchievementDef(TypedDict):
    code: str
    name: str
    description: str
    icon: str
    category: str
    tier: str
    metric: str
    threshold: float


# (categoría, métrica, icono, [(código, nombre, descripción, umbral) x3])
_FAMILIES: list[tuple[str, str, str, list[tuple[str, str, str, float]]]] = [
    ("captures", "total_captures", "🎣", [
        ("CAPTURES_10", "Pescador constante", "Registra 10 capturas.", 10),
        ("CAPTURES_50", "Caña incansable", "Registra 50 capturas.", 50),
        ("CAPTURES_200", "Vive en el agua", "Registra 200 capturas.", 200),
    ]),
    ("species", "species_discovered", "📖", [
        ("SPECIES_10", "10 especies descubiertas", "Descubre 10 especies distintas.", 10),
        ("SPECIES_25", "25 especies descubiertas", "Descubre 25 especies distintas.", 25),
        ("SPECIES_50", "50 especies descubiertas", "Descubre 50 especies distintas.", 50),
    ]),
    ("rare", "rare_plus_species", "⭐", [
        ("FIRST_RARE", "Primera especie rara", "Desbloquea tu primera especie de rareza Raro o superior.", 1),
        ("RARE_5", "Coleccionista de rarezas", "Desbloquea 5 especies Raras o superiores.", 5),
        ("RARE_15", "Ojo de halcón", "Desbloquea 15 especies Raras o superiores.", 15),
    ]),
    ("epic", "epic_plus_species", "💎", [
        ("FIRST_EPIC", "Primera épica", "Desbloquea tu primera especie Épica o superior.", 1),
        ("EPIC_3", "Trío épico", "Desbloquea 3 especies Épicas o superiores.", 3),
        ("EPIC_8", "Leyenda en ciernes", "Desbloquea 8 especies Épicas o superiores.", 8),
    ]),
    ("legendary", "legendary_plus_species", "👑", [
        ("FIRST_LEGENDARY", "Primera legendaria", "Desbloquea tu primera especie de rareza Legendario o Mítico.", 1),
        ("LEGENDARY_3", "Cazador de leyendas", "Desbloquea 3 especies Legendarias o Míticas.", 3),
        ("LEGENDARY_5", "Mito viviente", "Desbloquea 5 especies Legendarias o Míticas.", 5),
    ]),
    ("heavy", "heaviest_kg", "⚖️", [
        ("HEAVY_5KG", "Más de 5 kg", "Registra una captura de más de 5 kg.", 5),
        ("HEAVY_15KG", "Pieza de 15 kg", "Registra una captura de más de 15 kg.", 15),
        ("HEAVY_40KG", "Monstruo de 40 kg", "Registra una captura de más de 40 kg.", 40),
    ]),
    ("long", "longest_cm", "📏", [
        ("LONG_50CM", "Medio metro", "Registra una captura de más de 50 cm.", 50),
        ("LONG_1M", "Más de 1 metro", "Registra una captura de más de 100 cm.", 100),
        ("LONG_150CM", "Metro y medio", "Registra una captura de más de 150 cm.", 150),
    ]),
    ("regions", "regions", "🗺️", [
        ("REGIONS_3", "Explorador nacional", "Consigue capturas en 3 comunidades autónomas distintas.", 3),
        ("REGIONS_6", "Trotamundos", "Consigue capturas en 6 comunidades autónomas distintas.", 6),
        ("REGIONS_10", "Vuelta a España", "Consigue capturas en 10 comunidades autónomas distintas.", 10),
    ]),
    ("friends", "friends", "🤝", [
        ("FRIENDS_1", "Compañero de pesca", "Haz tu primer amigo en FishDex.", 1),
        ("FRIENDS_5", "La cuadrilla", "Ten 5 amigos en FishDex.", 5),
        ("FRIENDS_15", "Club de pesca", "Ten 15 amigos en FishDex.", 15),
    ]),
    ("records", "personal_records", "🏆", [
        ("RECORDS_5", "Superándote", "Bate 5 récords personales.", 5),
        ("RECORDS_20", "Siempre a más", "Bate 20 récords personales.", 20),
        ("RECORDS_50", "Imparable", "Bate 50 récords personales.", 50),
    ]),
    ("photos", "captures_with_photo", "📸", [
        ("PHOTOS_5", "Fotógrafo aficionado", "Registra 5 capturas con foto.", 5),
        ("PHOTOS_25", "Álbum de pesca", "Registra 25 capturas con foto.", 25),
        ("PHOTOS_100", "Reportero del río", "Registra 100 capturas con foto.", 100),
    ]),
    ("challenges", "challenges_won", "⚔️", [
        ("CHALLENGES_1", "Primera victoria", "Gana tu primer reto o torneo.", 1),
        ("CHALLENGES_5", "Rival temible", "Gana 5 retos o torneos.", 5),
        ("CHALLENGES_15", "Campeón indiscutible", "Gana 15 retos o torneos.", 15),
    ]),
    ("release", "released_captures", "🔄", [
        ("RELEASE_1", "Captura y suelta", "Devuelve tu primer pez al agua.", 1),
        ("RELEASE_10", "Guardián del río", "Devuelve 10 peces al agua.", 10),
        ("RELEASE_50", "Pescador responsable", "Devuelve 50 peces al agua.", 50),
    ]),
    ("spots", "spots", "📍", [
        ("SPOTS_1", "Mi rincón", "Guarda tu primer spot de pesca.", 1),
        ("SPOTS_5", "Mapa secreto", "Guarda 5 spots de pesca.", 5),
        ("SPOTS_15", "Cartógrafo", "Guarda 15 spots de pesca.", 15),
    ]),
]

_TIERS = (Tier.BRONZE, Tier.SILVER, Tier.GOLD)

ACHIEVEMENT_DEFS: list[AchievementDef] = [
    AchievementDef(
        code="FIRST_CATCH", name="Primera captura", description="Registra tu primera captura en FishDex.",
        icon="🐟", category="captures", tier=Tier.BRONZE, metric="total_captures", threshold=1,
    ),
]
for _category, _metric, _icon, _levels in _FAMILIES:
    for _tier, (_code, _name, _description, _threshold) in zip(_TIERS, _levels):
        ACHIEVEMENT_DEFS.append(
            AchievementDef(
                code=_code, name=_name, description=_description, icon=_icon,
                category=_category, tier=_tier, metric=_metric, threshold=_threshold,
            )
        )

ACHIEVEMENTS_BY_CODE: dict[str, AchievementDef] = {a["code"]: a for a in ACHIEVEMENT_DEFS}

# Máximo de insignias destacadas en la vitrina del perfil.
SHOWCASE_SIZE = 3
