/**
 * Mapeamento snake_case (Postgres) → camelCase (domínio). Única camada que conhece nomes de coluna.
 */
import type { CheckInStatus, EventCategory, EventView, FomoEvent, LiveStatus, MapEvent, Post, UserProfile } from '@/types/domain';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const toProfile = (r: Row): UserProfile => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  bio: r.bio,
  isPrivate: r.is_private,
  level: r.level,
  xp: r.xp,
  credibilityScore: Number(r.credibility_score),
  totalExperiences: r.total_experiences,
  totalReviews: r.total_reviews,
  followersCount: r.followers_count,
  followingCount: r.following_count,
  createdAt: r.created_at,
  isDemo: !!r.is_demo,
});

export const toCategory = (r: Row): EventCategory => ({ id: r.id, slug: r.slug, name: r.name });

export const toEvent = (r: Row): FomoEvent => ({
  id: r.id,
  title: r.title,
  description: r.description,
  categoryId: r.category_id,
  status: r.status,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  venueName: r.venue_name,
  address: r.address,
  latitude: r.latitude,
  longitude: r.longitude,
  priceMinCents: r.price_min_cents,
  priceMaxCents: r.price_max_cents,
  ticketUrl: r.ticket_url,
  coverUrl: r.cover_url ?? null,
  organizerId: r.organizer_id,
  createdBy: r.created_by,
  isSponsored: r.is_sponsored && (!r.sponsored_until || Date.parse(r.sponsored_until) > Date.now()),
  createdAt: r.created_at,
  isDemo: !!r.is_demo,
});

export const toEventView = (r: Row, savedByMe: boolean): EventView => ({
  ...toEvent(r),
  category: toCategory(r.category),
  savedByMe,
});

/** events_in_bounds() já devolve JSON em camelCase. */
export const toMapEvent = (j: Row): MapEvent => ({
  ...(j as unknown as EventView),
  coverUrl: j.coverUrl ?? null,
  isDemo: !!j.isDemo,
  live: j.live ? toLive(j.live) : null,
  distanceM: j.distanceM ?? null,
  happeningNow: !!j.happeningNow,
});

export const toLive = (j: Row): LiveStatus => ({
  eventId: j.eventId,
  crowd: j.crowd ?? null,
  vibe: j.vibe ?? null,
  music: j.music ?? null,
  queue: j.queue ?? null,
  reportsCount: j.reportsCount ?? 0,
  lastReportAt: j.lastReportAt ?? null,
  timeline: (j.timeline ?? []) as LiveStatus['timeline'],
});

export const toPost = (r: Row): Post => ({
  id: r.id,
  authorId: r.author_id,
  body: r.body,
  eventId: r.event_id,
  placeName: r.place_name,
  experienceDate: r.experience_date,
  categoryId: r.category_id,
  rating: r.rating,
  checkInId: r.check_in_id,
  visibility: r.visibility,
  mediaCount: r.media_count,
  likesCount: r.likes_count,
  commentsCount: r.comments_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const presenceOf = (status: CheckInStatus | null | undefined) => (status ?? 'none') as 'none' | CheckInStatus;

/** Mensagens amigáveis para erros lançados pelas funções do banco. */
export function friendlyError(e: unknown): Error {
  const msg = (e as { message?: string })?.message ?? String(e);
  const far = /too_far:(\d+)/.exec(msg);
  if (far) return new Error(`Você parece estar a ${far[1]} m do local. O relato só vale para quem está lá.`);
  const map: Record<string, string> = {
    cooldown: 'Você já informou este rolê há pouco. Tente de novo em alguns minutos.',
    rate_limited: 'Muitas ações em pouco tempo. Tente mais tarde.',
    event_not_live: 'Este rolê não está acontecendo agora.',
    username_taken: 'Esse @ já está em uso.',
    invalid_username: 'Use de 3 a 30 letras minúsculas, números, ponto ou _.',
    reserved_username: 'Esse @ é reservado.',
    blocked: 'Não é possível interagir com este perfil.',
    profile_required: 'Complete seu perfil antes de publicar.',
    too_many_media: 'Máximo de 10 fotos por publicação.',
    not_authenticated: 'Entre na sua conta para continuar.',
    username_change_paid: 'Você já usou sua troca grátis de @. Novas trocas custarão R$ 9,90 (em breve).',
    invalid_rating: 'A nota vai de 0,5 a 5, em meias estrelas.',
    invalid_duration: 'Escolha entre 15 min e 4 h.',
    not_sharing: 'Escolha por quanto tempo compartilhar.',
    checkin_closed: 'O check-in abre 3 h antes do rolê e fecha 2 h depois do fim.',
    invalid_reveal: 'Escolha quando sua presença pode aparecer.',
    dm_not_allowed: 'Esse perfil é privado: só dá para mandar mensagem se um de vocês seguir o outro.',
    event_not_available: 'Esse rolê não está disponível para grupos.',
    too_many_invites: 'Máximo de 30 convites por vez.',
    not_invited: 'Você não foi convidado para esse grupo.',
    series_too_long: 'Uma série pode ter no máximo 12 semanas.',
    event_in_past: 'Esse horário já passou. Escolha uma data futura.',
    invalid_avatar: 'Foto de perfil inválida. Envie de novo.',
    not_pending: 'Esse rolê já foi moderado.',
    forbidden: 'Você não tem permissão para isso.',
    'row-level security': 'Você não tem permissão para isso.',
  };
  for (const [k, v] of Object.entries(map)) if (msg.includes(k)) return new Error(v);
  if (/network|fetch/i.test(msg)) return new Error('Sem conexão. Verifique a internet e tente de novo.');
  return new Error('Algo deu errado. Tente de novo.');
}
