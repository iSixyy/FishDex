"""Geocodificación aproximada 100% offline usando el catálogo local de
`locations` (sin depender de ninguna API externa de pago)."""
import math

from sqlalchemy.orm import Session

from app.models.location import Location

# Margen (km) sobre `approx_radius_km` dentro del cual una captura se sigue
# asociando a una ubicación del catálogo. Holgado a propósito: el catálogo
# semilla es pequeño y la ubicación es solo aproximada.
MAX_MATCH_MARGIN_KM = 50.0


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_nearest_location(db: Session, latitude: float, longitude: float) -> Location | None:
    """Devuelve la ubicación conocida más cercana. Con el catálogo semilla
    (decenas de puntos) un escaneo lineal es más que suficiente para el MVP;
    con un catálogo mayor se sustituiría por una consulta espacial."""
    locations = db.query(Location).all()
    if not locations:
        return None
    return min(locations, key=lambda loc: _haversine_km(latitude, longitude, loc.latitude, loc.longitude))


def resolve_location_name(db: Session, latitude: float | None, longitude: float | None) -> tuple[str | None, str | None]:
    """Devuelve (nombre_legible, comunidad_autonoma) para unas coordenadas.

    Solo se acepta la ubicación conocida más cercana si está razonablemente
    cerca (su radio + `MAX_MATCH_MARGIN_KM`). Antes se devolvía SIEMPRE la
    más cercana, aunque estuviera a cientos de km: una captura en Portugal,
    Francia o en el interior sin puntos cercanos quedaba atribuida a una
    comunidad autónoma falsa, lo que además contaba para el logro de
    "3 comunidades distintas"."""
    if latitude is None or longitude is None:
        return None, None
    nearest = find_nearest_location(db, latitude, longitude)
    if nearest is None:
        return None, None
    distance = _haversine_km(latitude, longitude, nearest.latitude, nearest.longitude)
    if distance > nearest.approx_radius_km + MAX_MATCH_MARGIN_KM:
        return None, None
    return nearest.name, nearest.autonomous_community


def public_approximate_location(db: Session, latitude: float | None, longitude: float | None) -> str | None:
    """Ubicación aproximada apta para mostrar a OTROS usuarios (amigos,
    FishDex pública). Nunca expone coordenadas exactas."""
    name, community = resolve_location_name(db, latitude, longitude)
    if name is None:
        return None
    return name
