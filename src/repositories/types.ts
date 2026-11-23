import type {
  CreatePostInput,
  CrowdLevel,
  DateFilter,
  GeoBounds,
  GeoPoint,
  LiveStatus,
  MapEvent,
  MusicLevel,
  Neighborhood,
  PriceFilter,
  QueueLevel,
  VibeLevel,
  EventCategory,
  EventView,
  FeedTab,
  Page,
  PostView,
  ProfileView,
  ReviewView,
  CommentView,
  EventSubmission,
  LocalPhoto,
  NotificationView,
  ProfileSettings,
  UserProfile,
  ConversationPreview,
  GroupStatus,
  GroupView,
  Message,
  CheckinVisibility,
  CreateStoryInput,
  EventPresence,
  PersonSuggestion,
  StoryGroup,
  GroupLocation,
  ConversationInfo,
} from '@/types/domain';

/**
 * Contratos de acesso a dados. A UI depende SÓ destas interfaces.
 * Implementações: `mock/` (Fases 2–4) e `supabase/` (Fase 5).
 * Regras de visibilidade são responsabilidade da implementação (no Supabase: RLS).
 */

export type EventFilters = {
  categorySlug?: string | null;
  query?: string;
};

export type MapQuery = {
  /** Área visível do mapa — o backend só retorna eventos dentro dela (PostGIS). */
  bounds: GeoBounds;
  /** Origem para distância: localização autorizada ou centro do bairro escolhido. */
  origin: GeoPoint | null;
  categorySlug?: string | null;
  date?: DateFilter;
  maxDistanceKm?: number | null;
  price?: PriceFilter;
  query?: string;
  limit?: number;
};

export type ReportInput = {
  eventId: string;
  crowd: CrowdLevel;
  vibe: VibeLevel;
  music: MusicLevel | null;
  queue: QueueLevel;
  /** Leitura ÚNICA de localização no envio; não é armazenada, só comparada no servidor. */
  location: GeoPoint;
};

export type ReportResult = { accepted: true; xpPending: number; expiresAt: string; presenceVerified: boolean; presenceXp: number };

export interface LiveRepository {
  status(eventId: string): Promise<LiveStatus>;
  /** Valida distância, janela do evento e cooldown no servidor. Lança erro com mensagem amigável. */
  submit(input: ReportInput): Promise<ReportResult>;
}

export interface EventsRepository {
  /** Consulta por área visível + filtros. Nunca carrega todos os eventos. */
  listForMap(q: MapQuery): Promise<MapEvent[]>;
  listNeighborhoods(): Promise<Neighborhood[]>;
  listCategories(): Promise<EventCategory[]>;
  /** Apenas eventos aprovados e não encerrados. */
  listUpcoming(filters: EventFilters, cursor?: string | null): Promise<Page<EventView>>;
  getById(id: string): Promise<EventView | null>;
  listReviews(eventId: string): Promise<ReviewView[]>;
  toggleSave(eventId: string): Promise<boolean>;
  listSaved(): Promise<EventView[]>;
  /** Sugestão de rolê: entra sempre como `pending` (RLS impede outro status). */
  submit(input: EventSubmission): Promise<EventView>;
  /** Minhas sugestões (qualquer status). */
  listMine(): Promise<EventView[]>;
  /** Fila de moderação — só retorna algo para moderadores (RLS). */
  listPending(): Promise<EventView[]>;
  moderate(eventId: string, approve: boolean): Promise<void>;
  myReview(eventId: string): Promise<ReviewView | null>;
  /** Cria ou edita a minha avaliação (1 por rolê). */
  saveReview(eventId: string, rating: number, body: string | null): Promise<ReviewView>;
}

export interface PostsRepository {
  feed(tab: FeedTab, cursor?: string | null): Promise<Page<PostView>>;
  getById(id: string): Promise<PostView | null>;
  listByAuthor(userId: string): Promise<PostView[]>;
  listByEvent(eventId: string): Promise<PostView[]>;
  toggleLike(postId: string): Promise<boolean>;
  toggleSave(postId: string): Promise<boolean>;
  listSaved(): Promise<PostView[]>;
  /** Envia fotos + cria o post (atômico no servidor). onProgress: 0–1. */
  create(input: CreatePostInput, onProgress?: (p: number) => void): Promise<PostView>;
  remove(postId: string): Promise<void>;
  report(postId: string, reason: string): Promise<void>;
}

export interface ProfilesRepository {
  me(): Promise<ProfileView>;
  getByUsername(username: string): Promise<ProfileView | null>;
  listReviews(userId: string): Promise<ReviewView[]>;
  /** Retorna o novo status: público → 'accepted'; privado → 'pending'; null = deixou de seguir. */
  toggleFollow(userId: string): Promise<'pending' | 'accepted' | null>;
  settings(): Promise<ProfileSettings>;
  updateSettings(patch: Partial<Omit<ProfileSettings, 'isModerator'>>): Promise<ProfileSettings>;
  /** Envia o avatar (comprimido) e devolve a URL pública. */
  uploadAvatar(photo: LocalPhoto): Promise<string>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  report(userId: string, reason: string): Promise<void>;
  /** Troca o @ (1 grátis; depois "username_change_paid"). */
  changeUsername(username: string): Promise<UserProfile>;
  search(query: string): Promise<UserProfile[]>;
  followers(userId: string): Promise<UserProfile[]>;
  following(userId: string): Promise<UserProfile[]>;
  /** Tira alguém dos MEUS seguidores. */
  removeFollower(userId: string): Promise<void>;
  /** Sugestões de amizade com o motivo ("Segue você", "2 amigos em comum"...). */
  suggestions(limit?: number): Promise<PersonSuggestion[]>;
  setDiscreetMode(on: boolean): Promise<void>;
}

export interface CheckinsRepository {
  presence(eventId: string): Promise<EventPresence>;
  /** revealMinutes > 0: ninguém vê até lá (a presença conta no número na hora). */
  checkIn(eventId: string, visibility: CheckinVisibility, revealMinutes: number): Promise<EventPresence>;
  checkOut(eventId: string): Promise<void>;
}

export interface StoriesRepository {
  tray(): Promise<StoryGroup[]>;
  create(input: CreateStoryInput, onProgress?: (p: number) => void): Promise<void>;
  view(storyId: string): Promise<void>;
  viewers(storyId: string): Promise<{ profile: UserProfile; viewedAt: string; liked: boolean }[]>;
  /** Curte/descurte. Devolve se ficou curtido. */
  like(storyId: string): Promise<boolean>;
  /** Responde no direct do autor. Devolve o id da conversa. */
  reply(storyId: string, body: string): Promise<string>;
  remove(storyId: string): Promise<void>;
}

export interface MessagesRepository {
  inbox(): Promise<ConversationPreview[]>;
  /** Abre (ou reaproveita) a conversa 1:1 com alguém. */
  open(userId: string): Promise<string>;
  peer(conversationId: string): Promise<UserProfile | null>;
  list(conversationId: string): Promise<Message[]>;
  send(conversationId: string, body: string): Promise<Message>;
  markRead(conversationId: string): Promise<void>;
  subscribe(conversationId: string, onMessage: (m: Message) => void): () => void;
  info(conversationId: string): Promise<ConversationInfo | null>;
  /** Grupo no direct: só entra quem você segue ou te segue. */
  createGroup(title: string, memberIds: string[]): Promise<string>;
  addMembers(conversationId: string, memberIds: string[]): Promise<number>;
  leave(conversationId: string): Promise<void>;
}

export interface GroupsRepository {
  mine(): Promise<GroupView[]>;
  get(groupId: string): Promise<GroupView | null>;
  create(eventId: string, name: string, invitees: string[]): Promise<string>;
  respond(groupId: string, status: Exclude<GroupStatus, 'invited'>): Promise<void>;
  invite(groupId: string, invitees: string[]): Promise<number>;
  leave(groupId: string): Promise<void>;
  createPoll(groupId: string, question: string, options: string[]): Promise<void>;
  vote(pollId: string, option: number): Promise<void>;
  /** Pessoas que eu sigo e que vão ao rolê (só o que eu já poderia ver). */
  friendsGoing(eventId: string): Promise<UserProfile[]>;
  /** "Cheguei bem": avisa o grupo. Devolve quantas pessoas foram avisadas (0 = já tinha avisado). */
  arrivedHome(groupId: string): Promise<number>;
  /** Localização ao vivo do grupo (só de quem compartilhou e só enquanto não vence). */
  locations(groupId: string): Promise<GroupLocation[]>;
  /** minutes: só na primeira vez (define até quando). Depois, só atualiza a posição. */
  shareLocation(groupId: string, point: GeoPoint, accuracyM: number | null, minutes?: number): Promise<string>;
  stopSharing(groupId: string): Promise<void>;
}

export interface SocialRepository {
  listComments(postId: string): Promise<CommentView[]>;
  addComment(postId: string, body: string): Promise<CommentView>;
  deleteComment(commentId: string): Promise<void>;
  notifications(): Promise<NotificationView[]>;
  unreadCount(): Promise<number>;
  markAllRead(): Promise<void>;
  /** Tempo real: chama `onChange` quando chega notificação nova. Retorna o "unsubscribe". */
  subscribe(onChange: () => void): () => void;
  followRequests(): Promise<UserProfile[]>;
  respondFollow(followerId: string, accept: boolean): Promise<void>;
}

export type Repositories = {
  events: EventsRepository;
  live: LiveRepository;
  posts: PostsRepository;
  profiles: ProfilesRepository;
  social: SocialRepository;
  messages: MessagesRepository;
  groups: GroupsRepository;
  checkins: CheckinsRepository;
  stories: StoriesRepository;
};
