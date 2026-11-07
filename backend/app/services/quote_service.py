"""Selección de la frase de celebración mostrada al registrar una captura.

Flujo: Ollama disponible -> intenta generar/adaptar una frase original a
partir de una semilla local (mismo estilo). Si Ollama no responde o el
resultado no es válido, se usa directamente una frase local predefinida.
La app NUNCA depende de que la IA esté disponible.
"""
import random

from sqlalchemy.orm import Session

from app.core.game_config import Rarity
from app.models.quote import Quote, QuoteTrigger
from app.services.ai_service import ai_service

MAX_AI_QUOTE_LENGTH = 160
RARE_PLUS_RARITIES = {Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY, Rarity.MYTHIC}

_AI_SYSTEM_PROMPT = (
    "Eres un cuñado español gracioso en una app de pesca llamada FishDex. "
    "Escribes una única frase corta (máximo 20 palabras) para celebrar una "
    "captura, con humor español tipo chiste malo o juego de palabras sobre "
    "pesca. Sin emojis, sin comillas, sin explicaciones, solo la frase."
)


def determine_trigger(
    *, is_new_species: bool, is_personal_record: bool, rarity: str, weight_kg: float, species_max_weight_kg: float
) -> str:
    if is_new_species:
        return QuoteTrigger.NEW_SPECIES
    if is_personal_record:
        return QuoteTrigger.PERSONAL_RECORD
    if Rarity(rarity) in RARE_PLUS_RARITIES:
        return QuoteTrigger.RARE_PLUS
    if species_max_weight_kg > 0 and weight_kg >= species_max_weight_kg * 0.85:
        return QuoteTrigger.HEAVY_CATCH
    return QuoteTrigger.GENERIC


def _pick_local_quote(db: Session, trigger: str, weight_kg: float) -> str:
    query = db.query(Quote).filter(Quote.is_active.is_(True), Quote.trigger == trigger)
    candidates = [q for q in query.all() if q.min_weight_kg is None or weight_kg >= q.min_weight_kg]
    if not candidates:
        candidates = db.query(Quote).filter(Quote.is_active.is_(True), Quote.trigger == QuoteTrigger.GENERIC).all()
    if not candidates:
        return "¡Buena captura! Hoy el pez ha picado... y tú también."
    return random.choice(candidates).text


def get_celebration_quote(
    db: Session,
    *,
    species_name: str,
    is_new_species: bool,
    is_personal_record: bool,
    rarity: str,
    weight_kg: float,
    species_max_weight_kg: float,
) -> str:
    trigger = determine_trigger(
        is_new_species=is_new_species,
        is_personal_record=is_personal_record,
        rarity=rarity,
        weight_kg=weight_kg,
        species_max_weight_kg=species_max_weight_kg,
    )
    seed_quote = _pick_local_quote(db, trigger, weight_kg)

    if ai_service.enabled and ai_service.is_available():
        context = (
            f"Especie: {species_name}. Peso: {weight_kg} kg. "
            f"Especie nueva: {'sí' if is_new_species else 'no'}. "
            f"Récord personal: {'sí' if is_personal_record else 'no'}. "
            f"Frase de ejemplo con el estilo deseado: \"{seed_quote}\". "
            "Escribe una frase NUEVA y original con ese mismo estilo."
        )
        ai_text = ai_service.generate_text(context, system=_AI_SYSTEM_PROMPT)
        if ai_text and len(ai_text) <= MAX_AI_QUOTE_LENGTH:
            return ai_text.strip('"')

    return seed_quote
