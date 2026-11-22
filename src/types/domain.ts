/**
 * Tipos de domínio do FOMO (camelCase no app; snake_case no Postgres — o mapeamento
 * fica nos repositories). Fonte de verdade de regras: backend (RLS + funções SQL).
 *
 * Decisões V2 refletidas aqui:
 * - Popularidade (followers/likes), Experiência (xp/level) e Credibilidade são sinais SEPARADOS.
 * - Presença tem 3 estados distintos: none | declared | verified. "declared" nunca é exibido como comprovado.
 * - Perfis são públicos por padrão; privados exigem aprovação de seguidores.
 */

export type ISODateString = string;
export type UUID = string;

/* ───────────────────────── Perfil ───────────────────────── */

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;

  isPrivate: boolean;

  level: number;
  xp: number;
  credibilityScore: number;

  totalExperiences: number;
  totalReviews: number;

  followersCount: number;
  followingCount: number;

  createdAt: string;
  /** Perfil de demonstração (beta): não é uma pessoa real. */
  isDemo?: boolean;
};

/** Relação do visitante com um perfil — calculada pelo backend, nunca pelo cliente. */
export type ViewerRelationship = {
  isSelf: boolean;
  followStatus: FollowStatus | null;
  followsViewer: boolean;
  isBlocked: boolean;
  /** true se o visitante pode ver publicações/histórico (público, ou privado + seguidor aceito). */
  canViewContent: boolean;
};

export type FollowStatus = 'pending' | 'accepted';

/* ───────────────────────── Check-in / Presença ───────────────────────── */

export type CheckInStatus = 'declared' | 'verified';
export type ContentVisibility = 'public' | 'followers' | 'private';

/**
 * Valores previstos para verificationMethod (texto livre no tipo, validado no backend):
 * 'organizer_code' | 'qr_code' | 'one_time_location' | 'admin_review'.
 * 'one_time_location' = leitura ÚNICA de localização com consentimento, sem rastreamento contínuo.
 */
export type CheckIn = {
  id: string;
  userId: string;
  eventId: string | null;

  status: 'declared' | 'verified';
  verificationMethod: string | null;

  visibility: 'public' | 'followers' | 'private';

  createdAt: string;
};

/**
 * Presença associada a uma publicação. Derivada:
 * - 'none'     → publicação sem declaração de presença (checkInId = null)
 * - 'declared' → usuário declarou que esteve lá (exibir como "Disse que esteve")
 * - 'verified' → confirmada por mecanismo de validação (exibir como "Presença confirmada")
 */
export type PresenceState = 'none' | CheckInStatus;

/* ───────────────────────── Eventos e lugares ───────────────────────── */

export type EventStatus = 'pending' | 'approved' | 'cancelled' | 'ended';

export type EventCategory = {
  id: UUID;
  slug: string; // 'festas' | 'bares' | 'shows' | 'geek' | ...
  name: string;
};

export type PriceRange = 'free' | 'low' | 'mid' | 'high';

export type FomoEvent = {
  id: UUID;
  title: string;
  description: string | null;
  categoryId: UUID;
  status: EventStatus;
  startsAt: ISODateString;
  endsAt: ISODateString | null;
  venueName: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  ticketUrl: string | null;
  coverUrl: string | null;
  organizerId: UUID | null;
  createdBy: UUID;
  /** Preparado para monetização futura; sempre rotulado como patrocinado na UI. */
  isSponsored: boolean;
  createdAt: ISODateString;
  /** Rolê de demonstração (beta): local fictício. */
  isDemo?: boolean;
};

/* ───────────────────────── Publicações ───────────────────────── */

export type Post = {
  id: UUID;
  authorId: UUID;
  body: string | null;
  eventId: UUID | null;
  placeName: string | null;
  experienceDate: ISODateString | null;
  categoryId: UUID | null;
  /** Nota opcional 1–5 associada à experiência. Avaliações completas ficam em reviews. */
  rating: number | null;
  checkInId: UUID | null;
  visibility: ContentVisibility;
  mediaCount: number;
  likesCount: number;
  commentsCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PostMedia = {
  id: UUID;
  postId: UUID;
  storagePath: string;
  width: number | null;
  height: number | null;
  position: number;
};

export type FeedTab = 'for_you' | 'following';

/* ───────────────────────── Reputação e gamificação ───────────────────────── */

export type LevelDefinition = {
  level: number;
  name: string;
  minXp: number;
};

/** Fatores explicáveis da credibilidade, exibidos na tela "Como calculamos". */
export type CredibilityBreakdown = {
  score: number; // 0–100
  factors: Array<{
    key: 'helpful_reviews' | 'consistency' | 'moderation_history' | 'diversity' | 'verified_presence';
    label: string;
    contribution: number;
  }>;
  computedAt: ISODateString;
};

/* ───────────────────────── Avaliações ───────────────────────── */

export type Review = {
  id: UUID;
  authorId: UUID;
  eventId: UUID | null;
  rating: number; // 1–5
  body: string | null;
  helpfulCount: number;
  createdAt: ISODateString;
};

/* ───────────────────────── View models (montados pelo backend/repository) ───────────────────────── */

/** Imagem exibível: URL (assinada/remota/local) ou asset empacotado (require). */
export type PhotoSource = { uri: string } | number;

export type PostPhoto = { source: PhotoSource; width: number; height: number };

export type PostView = Post & {
  author: UserProfile;
  photos: PostPhoto[];
  presence: PresenceState;
  event: FomoEvent | null;
  category: EventCategory | null;
  likedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
};

export type EventView = FomoEvent & {
  category: EventCategory;
  savedByMe: boolean;
};

export type ReviewView = Review & { author: UserProfile };

export type ProfileView = {
  profile: UserProfile;
  relationship: ViewerRelationship;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

/* ───────────────────────── Ao vivo: relatos e termômetro ───────────────────────── */

/** 1 tranquilo · 2 animado · 3 cheio · 4 lotado */
export type CrowdLevel = 1 | 2 | 3 | 4;
export type VibeLevel = 'chato' | 'ok' | 'bom' | 'bombando';
export type MusicLevel = 'ruim' | 'ok' | 'bom' | 'sem_som';
export type QueueLevel = 'sem_fila' | 'curta' | 'media' | 'longa';

/**
 * Relato "ao vivo" feito por quem está no local. Vale por RELATO_TTL_MIN.
 * Exige verificação ÚNICA de localização no momento do envio (sem rastreamento).
 * Nunca exibido individualmente com autor — só agregado.
 */
export type LiveReport = {
  id: UUID;
  userId: UUID;
  eventId: UUID;
  crowd: CrowdLevel;
  vibe: VibeLevel;
  /** Opcional: o relato mínimo é lotação + vibe + fila (3 toques). */
  music: MusicLevel | null;
  queue: QueueLevel;
  verification: 'one_time_location';
  createdAt: ISODateString;
};

/** Agregado calculado no servidor (mock: no repository). */
export type LiveStatus = {
  eventId: UUID;
  /** null quando há menos que o mínimo de relatos recentes. */
  crowd: CrowdLevel | null;
  vibe: VibeLevel | null;
  music: MusicLevel | null;
  queue: QueueLevel | null;
  reportsCount: number;
  lastReportAt: ISODateString | null;
  /** Lotação média por hora desde a abertura (para "Como foi a noite"). */
  timeline: Array<{ hour: string; crowd: CrowdLevel | null }>;
};

export type GeoPoint = { latitude: number; longitude: number };
export type GeoBounds = { north: number; south: number; east: number; west: number };

export type DateFilter = 'now' | 'today' | 'weekend' | 'any';
export type PriceFilter = 'any' | 'free' | 'upTo50' | 'over50';

export type MapEvent = EventView & {
  live: LiveStatus | null;
  /** Metros a partir da origem escolhida (localização ou bairro). */
  distanceM: number | null;
  happeningNow: boolean;
};

export type Neighborhood = { id: string; name: string; center: GeoPoint };

/* ───────────────────────── Criação de publicação ───────────────────────── */

/** Foto já preparada no aparelho (redimensionada/comprimida) aguardando envio. */
export type LocalPhoto = { uri: string; width: number; height: number };

export type CreatePostInput = {
  photos: LocalPhoto[];
  body: string;
  eventId: UUID | null;
  placeName: string | null;
  experienceDate: string | null; // YYYY-MM-DD
  categoryId: UUID | null;
  rating: number | null;
  visibility: ContentVisibility;
  /** Declara presença ("Disse que esteve"). Nunca vira "confirmada" por aqui. */
  declarePresence: boolean;
};

/* ───────────────────────── Social (Fase 6) ───────────────────────── */

export type CommentView = {
  id: UUID;
  postId: UUID;
  body: string;
  createdAt: ISODateString;
  author: UserProfile;
  /** Autor do comentário ou dono do post podem apagar (RLS decide; isto é só para a UI). */
  canDelete: boolean;
};

export type NotificationType =
  | 'follow' | 'follow_request' | 'follow_accepted' | 'like' | 'comment' | 'achievement' | 'event_approved' | 'moderation';

export type NotificationView = {
  id: UUID;
  type: NotificationType;
  actor: UserProfile | null;
  entityType: string | null;
  entityId: UUID | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
};

/** Campos que o próprio usuário pode editar (espelha o GRANT de colunas em profiles). */
export type ProfileSettings = {
  displayName: string;
  bio: string | null;
  city: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  defaultCheckinVisibility: ContentVisibility;
  isModerator: boolean;
};

export type EventSubmission = {
  title: string;
  categoryId: UUID;
  startsAt: ISODateString;
  endsAt: ISODateString | null;
  venueName: string;
  address: string | null;
  location: GeoPoint;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  ticketUrl: string | null;
  description: string | null;
};
