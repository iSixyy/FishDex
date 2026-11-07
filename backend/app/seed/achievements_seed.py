from app.core.achievements import ACHIEVEMENT_DEFS

# Solo los campos que se guardan en la tabla `achievements` (la métrica y el
# umbral viven en código, en `app/core/achievements.py`).
ACHIEVEMENTS_SEED = [
    dict(
        code=a["code"], name=a["name"], description=a["description"], icon=a["icon"],
        category=a["category"], tier=a["tier"], sort_order=index,
    )
    for index, a in enumerate(ACHIEVEMENT_DEFS)
]
