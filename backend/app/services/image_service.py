"""Compresión de imágenes y generación de thumbnails con Pillow.

Evita guardar imágenes gigantes: recodifica a JPEG con un tamaño máximo
razonable y genera una miniatura ligera para las tarjetas de la FishDex.
"""
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps

from app.config import get_settings

settings = get_settings()

MAX_ORIGINAL_DIMENSION = 1600
THUMBNAIL_DIMENSION = 300
JPEG_QUALITY = 82


def _storage_paths() -> tuple[Path, Path]:
    base = Path(settings.storage_dir)
    original_dir = base / "original"
    thumb_dir = base / "thumbnails"
    original_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)
    return original_dir, thumb_dir


def save_capture_image(raw_bytes: bytes) -> tuple[str, str]:
    """Guarda la foto de una captura ya comprimida + su thumbnail.
    Devuelve (ruta_original_relativa, ruta_thumbnail_relativa).
    Lanza PIL.UnidentifiedImageError/OSError si el fichero no es una imagen válida
    (el llamador la traduce a un 400 en vez de dejar que reviente en 500)."""
    original_dir, thumb_dir = _storage_paths()
    file_id = uuid.uuid4().hex

    image = Image.open(io.BytesIO(raw_bytes))
    image.load()  # fuerza la decodificación completa para detectar ficheros corruptos ya aquí
    image = ImageOps.exif_transpose(image)  # respeta la orientación del móvil
    if image.mode != "RGB":
        image = image.convert("RGB")

    original = image.copy()
    original.thumbnail((MAX_ORIGINAL_DIMENSION, MAX_ORIGINAL_DIMENSION))
    original_name = f"{file_id}.jpg"
    original_path = original_dir / original_name
    original.save(original_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    thumb = image.copy()
    thumb.thumbnail((THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION))
    thumb_name = f"{file_id}_thumb.jpg"
    thumb_path = thumb_dir / thumb_name
    thumb.save(thumb_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    return f"original/{original_name}", f"thumbnails/{thumb_name}"


def to_public_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    return f"/media/{relative_path}"


def delete_capture_image(*relative_paths: str | None) -> None:
    """Borra ficheros guardados por `save_capture_image`. Se usa cuando la
    captura no llega a persistirse (error o duplicado), para no dejar
    imágenes huérfanas en `storage/`. Nunca lanza: es solo limpieza."""
    base = Path(settings.storage_dir)
    for relative_path in relative_paths:
        if not relative_path:
            continue
        try:
            (base / relative_path).unlink(missing_ok=True)
        except OSError:
            pass
