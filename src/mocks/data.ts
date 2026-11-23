/**
 * ⚠️ DADOS MOCKADOS — apenas para desenvolvimento das Fases 2–4.
 * Nenhum destes usuários, eventos, avaliações ou presenças é real.
 * Substituídos pelo Supabase na Fase 5 (mesmos tipos de domínio).
 */
import type {
  CheckIn,
  CrowdLevel,
  EventCategory,
  FomoEvent,
  LiveReport,
  MusicLevel,
  Neighborhood,
  Post,
  PostPhoto,
  QueueLevel,
  Review,
  UserProfile,
  VibeLevel,
} from '@/types/domain';

const now = Date.now();
const H = 3_600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();
/** Próxima ocorrência de um horário (ex.: hoje 23h ou amanhã). */
const at = (daysFromNow: number, hour: number) => {
  const d = new Date(now + daysFromNow * D);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

export const CURRENT_USER_ID = 'u-me';

export const categories: EventCategory[] = [
  { id: 'c-festas', slug: 'festas', name: 'Festas' },
  { id: 'c-bares', slug: 'bares', name: 'Bares' },
  { id: 'c-shows', slug: 'shows', name: 'Shows' },
  { id: 'c-geek', slug: 'geek', name: 'Geek' },
  { id: 'c-cultura', slug: 'cultura', name: 'Cultura' },
];

export const profiles: UserProfile[] = [
  {
    id: CURRENT_USER_ID, username: 'voce', displayName: 'Você', avatarUrl: null,
    bio: 'Testando o FOMO. Perfil de demonstração.', isPrivate: false,
    level: 2, xp: 180, credibilityScore: 41, totalExperiences: 3, totalReviews: 1,
    followersCount: 12, followingCount: 34, createdAt: iso(now - 40 * D),
  },
  {
    id: 'u-lia', username: 'lia.noturna', displayName: 'Lia Martins', avatarUrl: null,
    bio: 'Pista, vinil e bar escondido. Centro de SP.', isPrivate: false,
    level: 5, xp: 1820, credibilityScore: 86, totalExperiences: 64, totalReviews: 41,
    followersCount: 2310, followingCount: 188, createdAt: iso(now - 400 * D),
  },
  {
    id: 'u-caio', username: 'caiorole', displayName: 'Caio Reis', avatarUrl: null,
    bio: 'Shows e festival. Sempre na grade.', isPrivate: false,
    level: 3, xp: 460, credibilityScore: 58, totalExperiences: 22, totalReviews: 9,
    followersCount: 9800, followingCount: 410, createdAt: iso(now - 200 * D),
  },
  {
    id: 'u-bia', username: 'bia.geek', displayName: 'Bia Tanaka', avatarUrl: null,
    bio: 'Board game, anime e karaokê.', isPrivate: true,
    level: 4, xp: 910, credibilityScore: 77, totalExperiences: 38, totalReviews: 27,
    followersCount: 640, followingCount: 220, createdAt: iso(now - 300 * D),
  },
  {
    id: 'u-teo', username: 'teo.insider', displayName: 'Téo Andrade', avatarUrl: null,
    bio: 'Bares autorais e coquetelaria.', isPrivate: false,
    level: 6, xp: 3400, credibilityScore: 91, totalExperiences: 120, totalReviews: 88,
    followersCount: 4100, followingCount: 95, createdAt: iso(now - 700 * D),
  },
];

const ev = (e: Partial<FomoEvent> & Pick<FomoEvent, 'id' | 'title' | 'categoryId' | 'startsAt' | 'latitude' | 'longitude'>): FomoEvent => ({
  description: null, status: 'approved', endsAt: null, venueName: null, address: null,
  priceMinCents: null, priceMaxCents: null, ticketUrl: null, coverUrl: null, organizerId: null,
  createdBy: 'u-lia', isSponsored: false, createdAt: iso(now - 5 * D), ...e,
});

export const events: FomoEvent[] = [
  ev({ id: 'e-1', title: 'Baile da Lua', categoryId: 'c-festas', startsAt: iso(now - 2 * H), endsAt: iso(now + 4 * H),
    venueName: 'Galpão 33', address: 'R. Fictícia, 120 — Barra Funda, São Paulo', latitude: -23.5253, longitude: -46.6669,
    priceMinCents: 4000, priceMaxCents: 8000, ticketUrl: 'https://example.com/ingressos/baile-lua-cheia',
    description: 'Festa de house e disco até o sol nascer. Line-up com DJs locais e pista ao ar livre.' }),
  ev({ id: 'e-2', title: 'Quinta do Vinil', categoryId: 'c-bares', startsAt: iso(now - 3 * H), endsAt: iso(now + 2 * H),
    venueName: 'Bar Exemplo', address: 'R. Fictícia, 45 — Pinheiros, São Paulo', latitude: -23.5666, longitude: -46.6893,
    priceMinCents: 0, priceMaxCents: 0, description: 'Discotecagem só de vinil, entrada gratuita até 22h.' }),
  ev({ id: 'e-3', title: 'Indie na Laje', categoryId: 'c-shows', startsAt: iso(at(2, 21)), venueName: 'Casa de Shows Demo',
    address: 'Av. Fictícia, 900 — Centro, São Paulo', latitude: -23.5432, longitude: -46.6388,
    priceMinCents: 6000, priceMaxCents: 12000, ticketUrl: 'https://example.com/ingressos/indie-laje',
    description: 'Três bandas independentes em noite de lançamento.' }),
  ev({ id: 'e-4', title: 'Noite de Board Games', categoryId: 'c-geek', startsAt: iso(at(3, 19)), venueName: 'Taverna Demo',
    address: 'R. Fictícia, 300 — Liberdade, São Paulo', latitude: -23.5587, longitude: -46.6345,
    priceMinCents: 2500, priceMaxCents: 2500, description: 'Mais de 200 jogos de tabuleiro, monitores para ensinar regras.' }),
  ev({ id: 'e-5', title: 'Sunset no Terraço', categoryId: 'c-festas', startsAt: iso(at(5, 17)), venueName: 'Terraço Exemplo',
    address: 'R. Fictícia, 77 — Vila Madalena, São Paulo', latitude: -23.5558, longitude: -46.6912,
    priceMinCents: 5000, priceMaxCents: 5000, isSponsored: true, description: 'Pôr do sol com DJ set e drinks autorais.' }),
  ev({ id: 'e-6', title: 'Sarau na Praça', categoryId: 'c-cultura', startsAt: iso(at(6, 18)), venueName: 'Praça Demo',
    address: 'Praça Fictícia — Bela Vista, São Paulo', latitude: -23.5568, longitude: -46.6476,
    priceMinCents: 0, priceMaxCents: 0, description: 'Microfone aberto para poesia e música.' }),
  ev({ id: 'e-7', title: 'Terraço Norte', categoryId: 'c-bares', startsAt: iso(now - 1 * H), endsAt: iso(now + 5 * H),
    venueName: 'Terraço Norte', address: 'R. Fictícia, 210 — Vila Madalena, São Paulo', latitude: -23.5531, longitude: -46.6880,
    priceMinCents: 0, priceMaxCents: 0, description: 'Rooftop com DJ residente. Entrada livre.' }),
  ev({ id: 'e-8', title: 'Samba da Esquina', categoryId: 'c-bares', startsAt: iso(now - 2 * H), endsAt: iso(now + 3 * H),
    venueName: 'Bar da Esquina', address: 'R. Fictícia, 12 — Pinheiros, São Paulo', latitude: -23.5629, longitude: -46.6821,
    priceMinCents: 2000, priceMaxCents: 2000, description: 'Roda de samba ao vivo toda noite.' }),
  ev({ id: 'e-9', title: 'Techno no Porão', categoryId: 'c-festas', startsAt: iso(now - 1 * H), endsAt: iso(now + 6 * H),
    venueName: 'Porão Demo', address: 'R. Fictícia, 404 — Consolação, São Paulo', latitude: -23.5517, longitude: -46.6559,
    priceMinCents: 3000, priceMaxCents: 6000, ticketUrl: 'https://example.com/ingressos/porao' }),
  ev({ id: 'e-10', title: 'Karaokê da Liberdade', categoryId: 'c-geek', startsAt: iso(now - 1 * H), endsAt: iso(now + 3 * H),
    venueName: 'Karaokê Demo', address: 'R. Fictícia, 88 — Liberdade, São Paulo', latitude: -23.5603, longitude: -46.6339,
    priceMinCents: 1500, priceMaxCents: 1500 }),
  ev({ id: 'e-11', title: 'Jazz no Bixiga', categoryId: 'c-shows', startsAt: iso(at(1, 21)), venueName: 'Clube Demo',
    address: 'R. Fictícia, 50 — Bela Vista, São Paulo', latitude: -23.5605, longitude: -46.6489,
    priceMinCents: 4000, priceMaxCents: 4000 }),
  // Exemplos que NÃO devem aparecer como futuros:
  ev({ id: 'e-old', title: 'Festa que já passou', categoryId: 'c-festas', status: 'ended', startsAt: iso(now - 3 * D),
    latitude: -23.55, longitude: -46.63 }),
  ev({ id: 'e-pending', title: 'Evento aguardando moderação', categoryId: 'c-shows', status: 'pending',
    startsAt: iso(at(4, 22)), latitude: -23.55, longitude: -46.64, createdBy: CURRENT_USER_ID }),
];

export const checkIns: CheckIn[] = [
  { id: 'ci-1', userId: 'u-lia', eventId: 'e-old', status: 'verified', verificationMethod: 'organizer_code', visibility: 'public', createdAt: iso(now - 3 * D) },
  { id: 'ci-2', userId: 'u-caio', eventId: 'e-old', status: 'declared', verificationMethod: null, visibility: 'public', createdAt: iso(now - 3 * D) },
  { id: 'ci-3', userId: 'u-bia', eventId: null, status: 'declared', verificationMethod: null, visibility: 'followers', createdAt: iso(now - 6 * D) },
];

const post = (p: Partial<Post> & Pick<Post, 'id' | 'authorId' | 'body'>): Post => ({
  eventId: null, placeName: null, experienceDate: null, categoryId: null, rating: null, checkInId: null,
  visibility: 'public', mediaCount: 0, likesCount: 0, commentsCount: 0, createdAt: iso(now - 2 * H), updatedAt: iso(now - 2 * H), ...p,
});

/**
 * Fotos de demonstração: imagens ABSTRATAS geradas (luzes desfocadas), não são fotos reais
 * de nenhum lugar. assets/mock/night-*.jpg
 */
const N1 = require('../../assets/mock/night-1.jpg');
const N2 = require('../../assets/mock/night-2.jpg');
const N3 = require('../../assets/mock/night-3.jpg');
const N4 = require('../../assets/mock/night-4.jpg');
const N5 = require('../../assets/mock/night-5.jpg');
const N6 = require('../../assets/mock/night-6.jpg');
const portrait = (source: number) => ({ source, width: 1080, height: 1350 });
const square = (source: number) => ({ source, width: 1080, height: 1080 });

/** Fotos por post (mock). Em produção vêm de post_media + URLs assinadas do Storage. */
export const postPhotos: Record<string, PostPhoto[]> = {
  'p-1': [portrait(N1), square(N3), portrait(N5)],
  'p-2': [portrait(N2)],
  'p-4': [square(N6)],
  'p-6': [portrait(N4), portrait(N1)],
  'p-7': [portrait(N5)],
};

export const posts: Post[] = [
  post({ id: 'p-1', mediaCount: 3, authorId: 'u-lia', body: 'Pista lotada mas sem aperto, som impecável e fila andou rápido. Volto com certeza.',
    eventId: 'e-old', placeName: 'Festa que já passou', experienceDate: iso(now - 3 * D), categoryId: 'c-festas', rating: 5,
    checkInId: 'ci-1', likesCount: 214, commentsCount: 18, createdAt: iso(now - 50 * 60_000) }),
  post({ id: 'p-2', mediaCount: 1, authorId: 'u-caio', body: 'Bom line-up, mas o bar demorou demais. Vale ir cedo.',
    eventId: 'e-old', placeName: 'Festa que já passou', experienceDate: iso(now - 3 * D), categoryId: 'c-festas', rating: 3,
    checkInId: 'ci-2', likesCount: 1530, commentsCount: 96, createdAt: iso(now - 3 * H) }),
  post({ id: 'p-3', authorId: 'u-teo', body: 'Dica: o balcão dos fundos tem drinks fora do cardápio. Pergunte pelo da casa.',
    placeName: 'Bar Exemplo', categoryId: 'c-bares', rating: 4, likesCount: 87, commentsCount: 9, createdAt: iso(now - 7 * H) }),
  post({ id: 'p-4', mediaCount: 1, authorId: 'u-bia', body: 'Karaokê com fila organizada por app. Achei genial.',
    placeName: 'Taverna Demo', categoryId: 'c-geek', rating: 4, checkInId: 'ci-3', visibility: 'followers',
    likesCount: 40, commentsCount: 3, createdAt: iso(now - 20 * H) }),
  post({ id: 'p-5', authorId: CURRENT_USER_ID, body: 'Primeiro rolê registrado no FOMO 🎉',
    placeName: 'Bar Exemplo', categoryId: 'c-bares', rating: 4, likesCount: 3, createdAt: iso(now - 2 * D) }),
  post({ id: 'p-6', mediaCount: 2, authorId: 'u-lia', body: 'Quinta do Vinil continua sendo o melhor esquenta grátis da cidade.',
    eventId: 'e-2', placeName: 'Bar Exemplo', categoryId: 'c-bares', rating: 5, likesCount: 310, commentsCount: 22,
    createdAt: iso(now - 26 * H) }),
  post({ id: 'p-7', mediaCount: 1, authorId: 'u-teo', body: 'Coquetelaria nova no centro. Ambiente pequeno, chegue antes das 21h.',
    placeName: 'Endereço não informado', categoryId: 'c-bares', rating: 4, likesCount: 120, commentsCount: 11,
    createdAt: iso(now - 30 * H) }),
];

export const reviews: Review[] = [
  { id: 'r-1', authorId: 'u-lia', eventId: 'e-2', rating: 5, body: 'Som bom, preço justo, equipe simpática.', helpfulCount: 32, createdAt: iso(now - 8 * D) },
  { id: 'r-2', authorId: 'u-teo', eventId: 'e-2', rating: 4, body: 'Lota rápido depois das 22h.', helpfulCount: 18, createdAt: iso(now - 12 * D) },
  { id: 'r-3', authorId: CURRENT_USER_ID, eventId: 'e-2', rating: 4, body: 'Gostei bastante.', helpfulCount: 1, createdAt: iso(now - 2 * D) },
];

/** Follows aceitos (follower → followee). Bia é privada e o usuário atual NÃO a segue. */
export const follows: Array<{ followerId: string; followeeId: string; status: 'pending' | 'accepted' }> = [
  { followerId: CURRENT_USER_ID, followeeId: 'u-lia', status: 'accepted' },
  { followerId: CURRENT_USER_ID, followeeId: 'u-teo', status: 'accepted' },
  // solicitação pendente PARA o usuário atual (demonstra aceitar/recusar)
  { followerId: 'u-bia', followeeId: CURRENT_USER_ID, status: 'pending' },
];

export const blocks = new Set<string>();

/** Configurações editáveis do usuário atual (mock). Demo: é moderador para mostrar a fila. */
export const mySettings = {
  city: 'São Paulo' as string | null,
  defaultCheckinVisibility: 'followers' as 'public' | 'followers' | 'friends' | 'private',
  discreetMode: false,
  isModerator: true,
};

export const comments: Array<{ id: string; postId: string; authorId: string; body: string; createdAt: string }> = [
  { id: 'cm-1', postId: 'p-1', authorId: 'u-caio', body: 'Fila andou rápido mesmo, cheguei 23h e entrei em 10 min.', createdAt: iso(now - 40 * 60_000) },
  { id: 'cm-2', postId: 'p-1', authorId: 'u-teo', body: 'Qual foi o melhor set?', createdAt: iso(now - 30 * 60_000) },
  { id: 'cm-3', postId: 'p-5', authorId: 'u-lia', body: 'Bem-vindo! Esse bar é ótimo.', createdAt: iso(now - 40 * H) },
];

export const notifications: Array<{
  id: string; type: 'follow' | 'follow_request' | 'follow_accepted' | 'like' | 'comment' | 'achievement' | 'event_approved' | 'moderation';
  actorId: string | null; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string;
}> = [
  { id: 'n-1', type: 'follow_request', actorId: 'u-bia', entityType: null, entityId: null, readAt: null, createdAt: iso(now - 15 * 60_000) },
  { id: 'n-2', type: 'comment', actorId: 'u-lia', entityType: 'post', entityId: 'p-5', readAt: null, createdAt: iso(now - 40 * H) },
  { id: 'n-3', type: 'like', actorId: 'u-caio', entityType: 'post', entityId: 'p-5', readAt: iso(now - 30 * H), createdAt: iso(now - 44 * H) },
  { id: 'n-4', type: 'achievement', actorId: null, entityType: 'achievement', entityId: 'first_post', readAt: iso(now - 40 * H), createdAt: iso(now - 47 * H) },
];

export const saved = {
  events: new Set<string>(['e-1', 'e-4']),
  posts: new Set<string>(['p-3']),
  likes: new Set<string>(['p-6']),
};

export { neighborhoods } from '@/config/neighborhoods';

/**
 * Relatos ao vivo fictícios. Gerados de forma determinística por evento "acontecendo agora",
 * com horários dentro e fora da janela de 90 min (para exercitar a regra de validade).
 */
type Profile4 = { crowd: CrowdLevel; vibe: VibeLevel; music: MusicLevel; queue: QueueLevel; count: number; spreadMin: number };
const LIVE_PROFILE: Record<string, Profile4> = {
  'e-1': { crowd: 4, vibe: 'bombando', music: 'bom', queue: 'curta', count: 23, spreadMin: 60 },
  'e-8': { crowd: 3, vibe: 'bom', music: 'bom', queue: 'sem_fila', count: 11, spreadMin: 70 },
  'e-9': { crowd: 3, vibe: 'bombando', music: 'bom', queue: 'longa', count: 9, spreadMin: 50 },
  'e-2': { crowd: 2, vibe: 'bom', music: 'bom', queue: 'sem_fila', count: 7, spreadMin: 80 },
  'e-7': { crowd: 1, vibe: 'ok', music: 'ok', queue: 'sem_fila', count: 4, spreadMin: 85 },
  'e-10': { crowd: 2, vibe: 'bom', music: 'ok', queue: 'sem_fila', count: 2, spreadMin: 40 }, // < mínimo → "sem relatos"
};

function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}

export const liveReports: LiveReport[] = Object.entries(LIVE_PROFILE).flatMap(([eventId, p], k) => {
  const r = rng(k + 11);
  const list: LiveReport[] = [];
  for (let i = 0; i < p.count; i++) {
    const jitter = r();
    const crowd = Math.max(1, Math.min(4, p.crowd + (jitter < 0.15 ? -1 : jitter > 0.92 ? 1 : 0))) as CrowdLevel;
    list.push({
      id: `lr-${eventId}-${i}`, userId: `anon-${k}-${i}`, eventId, crowd,
      vibe: p.vibe, music: p.music, queue: p.queue, verification: 'one_time_location',
      createdAt: iso(now - Math.floor(r() * p.spreadMin) * 60_000 - 3 * 60_000),
    });
  }
  // relatos velhos (devem ser ignorados)
  list.push({ id: `lr-${eventId}-old`, userId: 'anon-old', eventId, crowd: 1, vibe: 'chato', music: 'ruim', queue: 'longa', verification: 'one_time_location', createdAt: iso(now - 4 * H) });
  return list;
});

/** Histórico por hora para "Como foi a noite" (mock). */
export const liveTimeline: Record<string, CrowdLevel[]> = {
  'e-1': [1, 2, 3, 3, 4, 4],
  'e-8': [1, 2, 2, 3, 3],
  'e-9': [1, 1, 2, 3],
  'e-2': [1, 2, 2, 2],
  'e-7': [1, 1, 1],
};
