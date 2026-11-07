"""Semilla de regulaciones.

A propósito es una lista MUY corta: solo se incluyen normas de las que hay
certeza razonable sobre la fuente oficial. Para el resto de especies no se
inserta ninguna fila, así que la app mostrará "Información no disponible"
en vez de arriesgarse a mostrar una talla mínima o veda incorrecta.

Antes de usar esta app con fines reales, estos datos deben verificarse y
ampliarse consultando las fuentes oficiales (Ministerio de Agricultura,
Pesca y Alimentación, y las Consejerías de cada comunidad autónoma).
"""
from app.models.regulation import RegulationScope

REGULATIONS_SEED = [
    dict(
        species_dex_number=1,  # Lubina
        scope=RegulationScope.STATE,
        autonomous_community=None,
        legal_min_length_cm=42.0,
        closed_season=None,
        daily_catch_limit=None,
        notes="Talla mínima de referencia de conservación (MCRS) fijada a nivel de la Unión Europea para la "
              "lubina (Dicentrarchus labrax) en aguas del Atlántico nororiental.",
        source="Reglamento (UE) 2019/1241 sobre medidas técnicas, anexo V",
    ),
]
