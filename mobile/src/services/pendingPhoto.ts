/** Traspaso en memoria del uri de la foto tomada en `/catch/camera` de
 * vuelta a `/catch/create`. Evitamos meter un uri (potencialmente largo,
 * sobre todo en Android con rutas de caché) como parámetro de la URL de
 * `router.back()`: un simple módulo en memoria es más simple y robusto,
 * ya que ambas pantallas viven en el mismo proceso de JS. */

let pendingPhotoUri: string | null = null;

export function setPendingPhoto(uri: string): void {
  pendingPhotoUri = uri;
}

/** Devuelve el uri pendiente (si lo hay) y lo limpia, para que no se vuelva
 * a aplicar por accidente en una visita posterior a la pantalla. */
export function consumePendingPhoto(): string | null {
  const uri = pendingPhotoUri;
  pendingPhotoUri = null;
  return uri;
}
