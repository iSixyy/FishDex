export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

export type WaterType = "FRESH" | "SALT" | "BRACKISH";

export interface RankInfo {
  key: string;
  name: string;
  icon: string;
  min_elo: number;
  max_elo: number | null;
  description: string;
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar: string | null;
  elo: number;
  rank: RankInfo;
  created_at: string;
  is_admin?: boolean;
}

export interface UserStats {
  total_captures: number;
  species_discovered: number;
  total_species: number;
  rare_plus_species: number;
  rarest_species_name: string | null;
  biggest_catch_weight_kg: number | null;
  biggest_catch_species_name: string | null;
}

export interface UserProfile {
  user: User;
  stats: UserStats;
  /** Vitrina de insignias (máx. 3). */
  showcase: AchievementPublic[];
  /** Insignias de temporada, de la más reciente a la más antigua. */
  season_awards?: SeasonAward[];
}

export type SeasonTier = "CHAMPION" | "PODIUM" | "TOP10" | "PARTICIPANT";

export interface SeasonAward {
  season_key: string;
  season_name: string;
  position: number;
  points: number;
  tier: SeasonTier;
  tier_label: string;
}

export interface SeasonPage {
  key: string;
  name: string;
  starts_at: string;
  ends_at: string;
  entries: RankedValueEntry[];
  me: RankedValueEntry | null;
  rewards: { tier: SeasonTier; label: string; positions: string }[];
}

export interface ForecastFactor {
  label: string;
  points: number;
  impact: "up" | "down" | "neutral";
  detail: string;
}

export interface BiteForecast {
  score: number;
  label: "Excelente" | "Buena" | "Regular" | "Mala";
  summary: string;
  factors: ForecastFactor[];
  /** Sin datos de clima: solo hora y luna. */
  partial: boolean;
  computed_at: string;
}

export interface HeatmapCell {
  latitude: number;
  longitude: number;
  captures: number;
  anglers: number;
}

export interface HeatmapResponse {
  species_id: number | null;
  species_name: string | null;
  cell_size_deg: number;
  min_anglers: number;
  cells: HeatmapCell[];
}

export interface FishingLicense {
  expires_on: string | null;
  region: string | null;
  /** Negativo si ya ha caducado. */
  days_left: number | null;
}

export type ReportTarget = "USER" | "CAPTURE" | "COMMENT";
export type ReportReason = "SPAM" | "OFFENSIVE" | "FAKE_CAPTURE" | "INAPPROPRIATE" | "OTHER";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegulationPublic {
  scope: "STATE" | "AUTONOMOUS";
  autonomous_community: string | null;
  legal_min_length_cm: number | null;
  closed_season: string | null;
  daily_catch_limit: number | null;
  closed_season_start?: string | null;
  closed_season_end?: string | null;
  notes: string | null;
  source: string | null;
}

export interface FishSpeciesDetail {
  id: number;
  dex_number: number;
  name: string;
  scientific_name: string;
  description: string;
  fun_fact: string;
  min_weight_kg: number;
  max_weight_kg: number;
  approx_min_length_cm: number;
  approx_max_length_cm: number;
  rarity: Rarity;
  rarity_label: string;
  rarity_color: string;
  habitat: string;
  water_type: WaterType;
  region: string;
  image_url: string | null;
  catch_difficulty?: number | null;
  origin?: "SEED" | "AI";
  regulations: RegulationPublic[];
}

export interface FishSpeciesSummary {
  id: number;
  dex_number: number;
  name: string | null;
  rarity: Rarity | null;
  rarity_label: string | null;
  rarity_color: string | null;
  /** Tu foto más reciente de la especie (el "sprite" de la Dex). */
  image_url: string | null;
  water_type?: WaterType | null;
  unlocked: boolean;
}

export interface FishDexProgress {
  discovered: number;
  total: number;
  species: FishSpeciesSummary[];
}

export interface FishCatalogEntry {
  id: number;
  dex_number: number;
  name: string;
  rarity: Rarity;
  rarity_label: string;
  rarity_color: string;
  water_type: WaterType;
  origin?: "SEED" | "AI";
}

export interface CapturePublic {
  id: number;
  fish_species_id: number;
  fish_species_name: string;
  rarity: Rarity;
  image_url: string | null;
  thumbnail_url: string | null;
  weight_kg: number;
  length_cm: number;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  bait_technique: string | null;
  /** Captura y suelta: el pez se devolvió al agua. */
  released?: boolean;
  captured_at: string;
  elo_earned: number;
  is_new_species: boolean;
  is_personal_record_weight: boolean;
  is_personal_record_length: boolean;
  weather?: WeatherInfo | null;
}

export interface PersonalRecordInfo {
  previous_weight_kg: number | null;
  previous_length_cm: number | null;
  new_weight_kg: number;
  new_length_cm: number;
  is_new_record: boolean;
}

export interface CaptureResult {
  capture: CapturePublic;
  elo_earned: number;
  total_elo: number;
  rank: string;
  is_new_species: boolean;
  record: PersonalRecordInfo;
  quote: string;
  new_achievements: string[];
}

export interface MapCapturePin {
  id: number;
  fish_species_name: string;
  rarity: Rarity;
  image_url: string | null;
  thumbnail_url: string | null;
  weight_kg: number;
  length_cm: number;
  latitude: number;
  longitude: number;
  location_name: string | null;
  captured_at: string;
}

export interface FriendPublic {
  user: User;
  species_discovered: number;
  total_species: number;
  rare_plus_species: number;
}

export interface FriendRequestPublic {
  id: number;
  from_user: User;
  to_user: User;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  created_at: string;
}

export interface FriendFishDex {
  user: User;
  dex: FishDexProgress;
}

export interface ComparisonEntry {
  user: User;
  species_discovered: number;
  rare_plus_species: number;
  legendary_plus_species: number;
}

export interface FriendComparison {
  me: ComparisonEntry;
  friend: ComparisonEntry;
}

export interface RankingEntry {
  position: number;
  user: User;
}

export interface FriendsRanking {
  entries: RankingEntry[];
}

export interface AchievementPublic {
  code: string;
  name: string;
  description: string;
  icon: string;
  category?: string | null;
  tier?: "BRONZE" | "SILVER" | "GOLD" | null;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface RarityConfigEntry {
  key: Rarity;
  label: string;
  color: string;
  base_elo: number;
}

export interface RankConfigEntry {
  key: string;
  name: string;
  icon: string;
  min_elo: number;
  max_elo: number | null;
  description: string;
}

export interface GameConfig {
  rarities: RarityConfigEntry[];
  ranks: RankConfigEntry[];
  ai_available: boolean;
  ai_vision_available?: boolean;
}

export interface WeatherInfo {
  fetched_at: string;
  summary: string | null;
  air_temperature_c: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  pressure_hpa: number | null;
  cloud_cover_pct: number | null;
  water_temperature_c: number | null;
  wave_height_m: number | null;
  tides: { type: "HIGH" | "LOW"; time: string; height_m: number }[];
  moon: { name: string; age_days: number; illumination: number };
}

export interface AIIdentifyResponse {
  available: boolean;
  identified: boolean;
  message: string;
  species: FishCatalogEntry | null;
  species_is_new_in_catalog: boolean;
  suggested_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  estimated_weight_kg: number | null;
  estimated_length_cm: number | null;
  catch_difficulty: number | null;
}

export interface SpotPhoto {
  id: number;
  image_url: string;
  thumbnail_url: string;
}

export interface Spot {
  id: number;
  owner: User;
  is_mine: boolean;
  name: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  photos: SpotPhoto[];
  shared_with: number[];
  created_at: string;
}

export type ChallengeKind = "DUEL" | "TOURNAMENT" | "EVENT";
export type ChallengeCriterion = "HEAVIEST" | "LONGEST" | "MOST_CAPTURES" | "MOST_SPECIES";
export type ChallengeStatus = "PENDING" | "ACTIVE" | "FINISHED" | "CANCELLED";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";

export interface ChallengeParticipant {
  user: User;
  status: ParticipantStatus;
  score: number;
  position: number | null;
}

export interface Challenge {
  id: number;
  kind: ChallengeKind;
  title: string;
  criterion: ChallengeCriterion;
  criterion_label: string;
  species_id: number | null;
  species_name: string | null;
  duration_days: number;
  status: ChallengeStatus;
  starts_at: string | null;
  ends_at: string | null;
  creator: User;
  winner: User | null;
  my_status: ParticipantStatus | null;
  participants: ChallengeParticipant[];
}

export interface RankedValueEntry {
  position: number;
  user: User;
  value: number;
}

export interface RankingPage {
  entries: RankedValueEntry[];
  me: RankedValueEntry | null;
}

export interface RegulationWarning {
  kind: string;
  severity: "danger" | "info";
  message: string;
  source: string | null;
}

export interface RegulationCheck {
  autonomous_community: string | null;
  has_data: boolean;
  warnings: RegulationWarning[];
}

export interface PendingCapture {
  /** También se envía como `client_id`: hace idempotente el reintento. */
  localId: string;
  /** Usuario que la registró. Una captura de otra cuenta que siga en la cola
   * tras un cambio de sesión nunca se sube con el token de la cuenta nueva.
   * Opcional por compatibilidad con colas guardadas antes de este campo. */
  user_id?: number | null;
  fish_species_id: number;
  weight_kg: number;
  length_cm: number;
  captured_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  bait_technique: string | null;
  released?: boolean;
  image_uri: string | null;
  created_at: string;
}

/** Captura que se ha eliminado de la cola de sincronización porque el
 * backend la ha rechazado de forma permanente (p.ej. captured_at demasiado
 * antiguo). Se conserva para que el usuario pueda ver por qué desapareció. */
export interface DiscardedCapture {
  capture: PendingCapture;
  reason: string;
  discarded_at: string;
}

/** Una captura tal y como aparece en el feed de Comunidad.
 *
 * IMPORTANTE (privacidad): nunca trae latitude/longitude, ni siquiera de un
 * amigo; solo `location_name`. Misma regla que ya aplica el mapa. */
export interface FeedEntry {
  id: number;
  user: User;
  fish_species_name: string;
  rarity: Rarity;
  image_url: string | null;
  thumbnail_url: string | null;
  weight_kg: number;
  length_cm: number;
  location_name: string | null;
  released?: boolean;
  captured_at: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

/** Comentario en una captura del feed de Comunidad. */
export interface CaptureComment {
  id: number;
  user: User;
  text: string;
  created_at: string;
}
