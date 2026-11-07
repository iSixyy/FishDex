/** Formateo de datos según convenciones de España: DD/MM/YYYY, 24h, kg/cm. */

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDateTime(isoString: string): string {
  return `${formatDate(isoString)} ${formatTime(isoString)}`;
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatLength(cm: number): string {
  return `${cm.toLocaleString("es-ES", { maximumFractionDigits: 1 })} cm`;
}

export function formatElo(elo: number): string {
  return elo.toLocaleString("es-ES");
}

export function toApiDateTime(date: Date): string {
  return date.toISOString();
}

/** Tiempo relativo en español ("hace 2 horas"). A partir de 7 días se
 * muestra la fecha absoluta, para no acabar diciendo "hace 340 días". */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return "hace un momento";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} minuto${diffMin === 1 ? "" : "s"}`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} hora${diffHour === 1 ? "" : "s"}`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `hace ${diffDay} día${diffDay === 1 ? "" : "s"}`;

  return formatDate(isoString);
}
