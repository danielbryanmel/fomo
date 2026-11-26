/**
 * Implementação MOCK dos repositórios. Simula latência e aplica as MESMAS regras de
 * visibilidade previstas nas políticas RLS (docs/DATA_MODEL.md), para que a UI já seja
 * construída contra o comportamento real. Não é segurança — é simulação.
 */
import * as db from '@/mocks/data';
import type {
  ContentVisibility,
  EventView,
  FomoEvent,
  Page,
  Post,
  PostView,
  ProfileView,
  ReviewView,
  UserProfile,
  ViewerRelationship,
} from '@/types/domain';
import { distanceM, inBounds } from '@/lib/geo';
import type { MapEvent } from '@/types/domain';
import type { Repositories } from '../types';
import type { CommentView, NotificationView, ProfileSettings } from '@/types/domain';
import { computeLiveStatus, isHappeningNow, mockLive } from './live';
import { mockGroups, mockMessages, mockProfilesExtra } from './social2';
import { mockCheckins, mockGroupsSafety, mockStories, mockSuggest } from './social4';

const ME = db.CURRENT_USER_ID;
const PAGE_SIZE = 5;
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const profileById = (id: string) => db.profiles.find((p) => p.id === id);
const categoryById = (id: string | null) => db.categories.find((c) => c.id === id) ?? null;

function followStatus(follower: string, followee: string) {
  return db.follows.find((f) => f.followerId === follower && f.followeeId === followee)?.status ?? null;
}

/** Espelho de can_view_profile_content() do backend. */
function canViewProfileContent(viewer: string, owner: UserProfile) {
  if (viewer === owner.id) return true;
  return !owner.isPrivate || followStatus(viewer, owner.id) === 'accepted';
}

/** Espelho de can_view_item() do backend. */
function canViewItem(viewer: string, ownerId: string, visibility: ContentVisibility) {
  const owner = profileById(ownerId);
  if (!owner) return false;
  if (viewer === ownerId) return true;
  if (visibility === 'private') return false;
  if (visibility === 'followers') return followStatus(viewer, ownerId) === 'accepted';
  return canViewProfileContent(viewer, owner);
}

function isUpcoming(e: FomoEvent) {
  const end = e.endsAt ? Date.parse(e.endsAt) : Date.parse(e.startsAt) + 8 * 3_600_000;
  return e.status === 'approved' && end > Date.now();
}

function toEventView(e: FomoEvent): EventView {
  return { ...e, category: categoryById(e.categoryId)!, savedByMe: db.saved.events.has(e.id) };
}

function toPostView(p: Post): PostView {
  const checkIn = p.checkInId ? db.checkIns.find((c) => c.id === p.checkInId) : null;
  return {
    ...p,
    author: profileById(p.authorId)!,
    photos: db.postPhotos[p.id] ?? [],
    presence: checkIn ? checkIn.status : 'none',
    event: p.eventId ? (db.events.find((e) => e.id === p.eventId) ?? null) : null,
    category: categoryById(p.categoryId),
    likedByMe: db.saved.likes.has(p.id),
    savedByMe: db.saved.posts.has(p.id),
    isMine: p.authorId === ME,
  };
}

function visiblePosts() {
  return db.posts.filter((p) => canViewItem(ME, p.authorId, p.visibility));
}

function paginate<T>(items: T[], cursor?: string | null): Page<T> {
  const start = cursor ? Number(cursor) : 0;
  const slice = items.slice(start, start + PAGE_SIZE);
  const next = start + PAGE_SIZE < items.length ? String(start + PAGE_SIZE) : null;
  return { items: slice, nextCursor: next };
}

function relationship(target: UserProfile): ViewerRelationship {
  const status = followStatus(ME, target.id);
  return {
    isSelf: target.id === ME,
    followStatus: status,
    followsViewer: followStatus(target.id, ME) === 'accepted',
    isBlocked: db.blocks.has(target.id),
    canViewContent: canViewProfileContent(ME, target),
  };
}

function toReviewView(r: (typeof db.reviews)[number]): ReviewView {
  return { ...r, author: profileById(r.authorId)! };
}

function matchesDate(e: FomoEvent, date: string | undefined) {
  if (!date || date === 'any') return true;
  const start = Date.parse(e.startsAt);
  const now = new Date();
  if (date === 'now') return isHappeningNow(e);
  if (date === 'today') {
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6).getTime(); // noite vai até 6h
    return start <= endOfDay;
  }
  // fim de semana: sexta 18h → domingo 23h59 da semana corrente/próxima
  const d = new Date(start);
  const day = d.getDay();
  return day === 5 ? d.getHours() >= 18 : day === 6 || day === 0;
}

function matchesPrice(e: FomoEvent, price: string | undefined) {
  if (!price || price === 'any') return true;
  const min = e.priceMinCents ?? e.priceMaxCents;
  if (min === null) return false;
  if (price === 'free') return min === 0;
  if (price === 'upTo50') return min <= 5000;
  return min > 5000;
}

export const mockRepositories: Repositories = {
  live: mockLive,
  events: {
    async listForMap(q) {
      await delay(280);
      const text = q.query?.trim().toLowerCase();
      const list: MapEvent[] = db.events
        .filter(isUpcoming)
        .filter((e) => inBounds({ latitude: e.latitude, longitude: e.longitude }, q.bounds))
        .filter((e) => !q.categorySlug || categoryById(e.categoryId)?.slug === q.categorySlug)
        .filter((e) => matchesDate(e, q.date))
        .filter((e) => matchesPrice(e, q.price))
        .filter((e) => !text || `${e.title} ${e.venueName ?? ''} ${e.address ?? ''}`.toLowerCase().includes(text))
        .map((e) => {
          const now = isHappeningNow(e);
          return {
            ...toEventView(e),
            happeningNow: now,
            live: now ? computeLiveStatus(e.id) : null,
            distanceM: q.origin ? distanceM(q.origin, { latitude: e.latitude, longitude: e.longitude }) : null,
          };
        })
        .filter((e) => !q.maxDistanceKm || e.distanceM === null || e.distanceM <= q.maxDistanceKm * 1000);
      // Ordenação explicável: acontecendo agora com lotação conhecida primeiro (mais cheio no topo),
      // depois por distância, depois por horário. Patrocinado NÃO sobe na ordem — só é rotulado.
      list.sort((a, b) => {
        const ha = a.live?.crowd ?? (a.happeningNow ? 0.5 : 0);
        const hb = b.live?.crowd ?? (b.happeningNow ? 0.5 : 0);
        if (hb !== ha) return hb - ha;
        if (a.distanceM !== null && b.distanceM !== null && a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
        return Date.parse(a.startsAt) - Date.parse(b.startsAt);
      });
      return list.slice(0, q.limit ?? 100);
    },
    async listNeighborhoods() {
      await delay(80);
      return db.neighborhoods;
    },
    async listCategories() {
      await delay(100);
      return db.categories;
    },
    async listUpcoming(filters, cursor) {
      await delay();
      const q = filters.query?.trim().toLowerCase();
      const list = db.events
        .filter(isUpcoming)
        .filter((e) => !filters.categorySlug || categoryById(e.categoryId)?.slug === filters.categorySlug)
        .filter((e) => !q || `${e.title} ${e.venueName ?? ''} ${e.address ?? ''}`.toLowerCase().includes(q))
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .map(toEventView);
      return paginate(list, cursor);
    },
    async getById(id) {
      await delay();
      const e = db.events.find((x) => x.id === id);
      if (!e) return null;
      // pendente só visível ao criador; encerrado continua acessível por link, marcado como encerrado
      if (e.status === 'pending' && e.createdBy !== ME) return null;
      return toEventView(e);
    },
    async listReviews(eventId) {
      await delay(200);
      return db.reviews.filter((r) => r.eventId === eventId).map(toReviewView);
    },
    async toggleSave(eventId) {
      await delay(150);
      const s = db.saved.events;
      s.has(eventId) ? s.delete(eventId) : s.add(eventId);
      return s.has(eventId);
    },
    async listSaved() {
      await delay();
      return db.events.filter((e) => db.saved.events.has(e.id)).map(toEventView);
    },
    async submit(input) {
      await delay(500);
      const e: FomoEvent = {
        id: `e-new-${Date.now()}`, title: input.title.trim(), description: input.description, categoryId: input.categoryId,
        status: 'pending', startsAt: input.startsAt, endsAt: input.endsAt, venueName: input.venueName, address: input.address,
        latitude: input.location.latitude, longitude: input.location.longitude, priceMinCents: input.priceMinCents,
        priceMaxCents: input.priceMaxCents, ticketUrl: input.ticketUrl, coverUrl: null, organizerId: null,
        createdBy: ME, isSponsored: false, createdAt: new Date().toISOString(),
      };
      db.events.push(e);
      return toEventView(e);
    },
    async listMine() {
      await delay(200);
      return db.events.filter((e) => e.createdBy === ME).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(toEventView);
    },
    async listPending() {
      await delay(250);
      if (!db.mySettings.isModerator) return [];
      return db.events.filter((e) => e.status === 'pending').map(toEventView);
    },
    async moderate(eventId, approve) {
      await delay(300);
      if (!db.mySettings.isModerator) throw new Error('Só moderadores podem fazer isso.');
      const e = db.events.find((x) => x.id === eventId && x.status === 'pending');
      if (!e) throw new Error('Esse rolê já foi moderado.');
      e.status = approve ? 'approved' : 'cancelled';
    },
    async myReview(eventId) {
      await delay(120);
      const r = db.reviews.find((x) => x.eventId === eventId && x.authorId === ME);
      return r ? toReviewView(r) : null;
    },
    async saveReview(eventId, rating, body, aspects = []) {
      await delay(300);
      const e = db.events.find((x) => x.id === eventId);
      if (!e || !(e.status === 'approved' || e.status === 'ended')) throw new Error('Esse rolê não aceita avaliações.');
      let r = db.reviews.find((x) => x.eventId === eventId && x.authorId === ME);
      if (r) Object.assign(r, { rating, body, aspects });
      else {
        r = { id: `r-${Date.now()}`, authorId: ME, eventId, rating, body, aspects, helpfulCount: 0, createdAt: new Date().toISOString() };
        db.reviews.unshift(r);
      }
      return toReviewView(r);
    },
  },

  posts: {
    async feed(tab, cursor) {
      await delay();
      let list = visiblePosts();
      if (tab === 'following') {
        list = list
          .filter((p) => p.authorId === ME || followStatus(ME, p.authorId) === 'accepted')
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      } else {
        // "Para você" (mock): recência + credibilidade do autor + engajamento com peso baixo.
        const score = (p: Post) => {
          const hours = (Date.now() - Date.parse(p.createdAt)) / 3_600_000;
          const recency = Math.exp(-hours / 24);
          const cred = (profileById(p.authorId)?.credibilityScore ?? 0) / 100;
          const engagement = Math.min(1, Math.log10(1 + p.likesCount) / 4);
          return 0.5 * recency + 0.35 * cred + 0.15 * engagement;
        };
        list = list.filter((p) => p.authorId !== ME).sort((a, b) => score(b) - score(a));
      }
      return paginate(list.map(toPostView), cursor);
    },
    async getById(id) {
      await delay();
      const p = visiblePosts().find((x) => x.id === id);
      return p ? toPostView(p) : null;
    },
    async listByAuthor(userId) {
      await delay();
      return visiblePosts().filter((p) => p.authorId === userId).map(toPostView);
    },
    async listByEvent(eventId) {
      await delay(250);
      return visiblePosts().filter((p) => p.eventId === eventId).map(toPostView);
    },
    async toggleLike(postId) {
      await delay(120);
      const s = db.saved.likes;
      const p = db.posts.find((x) => x.id === postId);
      if (s.has(postId)) {
        s.delete(postId);
        if (p) p.likesCount--;
      } else {
        s.add(postId);
        if (p) p.likesCount++;
      }
      return s.has(postId);
    },
    async toggleSave(postId) {
      await delay(120);
      const s = db.saved.posts;
      s.has(postId) ? s.delete(postId) : s.add(postId);
      return s.has(postId);
    },
    async listSaved() {
      await delay();
      return visiblePosts().filter((p) => db.saved.posts.has(p.id)).map(toPostView);
    },
    async create(input, onProgress) {
      // simula upload foto a foto
      for (let i = 0; i < input.photos.length; i++) {
        await delay(250);
        onProgress?.((i + 1) / (input.photos.length + 1));
      }
      await delay(200);
      if (!input.photos.length && input.body.trim().length === 0) throw new Error('Adicione uma foto ou escreva algo.');
      const id = `p-new-${Date.now()}`;
      let checkInId: string | null = null;
      if (input.declarePresence) {
        checkInId = `ci-new-${Date.now()}`;
        db.checkIns.push({ id: checkInId, userId: ME, eventId: input.eventId, status: 'declared', verificationMethod: null, visibility: 'followers', createdAt: new Date().toISOString() });
      }
      const now = new Date().toISOString();
      const post: Post = {
        id, authorId: ME, body: input.body.trim() || null, eventId: input.eventId, placeName: input.placeName,
        experienceDate: input.experienceDate, categoryId: input.categoryId, rating: input.rating, checkInId,
        visibility: input.visibility, mediaCount: input.photos.length, likesCount: 0, commentsCount: 0, createdAt: now, updatedAt: now,
      };
      db.posts.unshift(post);
      db.postPhotos[id] = input.photos.map((ph) => ({ source: { uri: ph.uri }, width: ph.width, height: ph.height }));
      const me = profileById(ME)!;
      if (input.eventId || input.placeName || input.experienceDate) me.totalExperiences++;
      onProgress?.(1);
      return toPostView(post);
    },
    async remove(postId) {
      await delay();
      const i = db.posts.findIndex((p) => p.id === postId && p.authorId === ME);
      if (i < 0) throw new Error('Você só pode excluir as próprias publicações.');
      db.posts.splice(i, 1);
    },
    async report() {
      await delay();
    },
  },

  profiles: {
    async me() {
      await delay(150);
      const p = profileById(ME)!;
      return { profile: p, relationship: relationship(p) } satisfies ProfileView;
    },
    async getByUsername(username) {
      await delay();
      const p = db.profiles.find((x) => x.username === username);
      return p ? { profile: p, relationship: relationship(p) } : null;
    },
    async listReviews(userId) {
      await delay();
      const owner = profileById(userId);
      if (!owner || !canViewProfileContent(ME, owner)) return [];
      return db.reviews.filter((r) => r.authorId === userId).map(toReviewView);
    },
    async toggleFollow(userId) {
      await delay(200);
      const i = db.follows.findIndex((f) => f.followerId === ME && f.followeeId === userId);
      if (i >= 0) {
        db.follows.splice(i, 1);
        return null;
      }
      const target = profileById(userId);
      // decisão V2: perfil privado → solicitação pendente; o cliente não escolhe o status.
      const status = target?.isPrivate ? 'pending' : 'accepted';
      db.follows.push({ followerId: ME, followeeId: userId, status });
      return status;
    },
    async settings() {
      await delay(120);
      return mySettings();
    },
    async updateSettings(patch) {
      await delay(300);
      const p = profileById(ME)!;
      if (patch.displayName !== undefined) {
        const v = patch.displayName.trim();
        if (v.length < 1 || v.length > 50) throw new Error('Nome precisa ter de 1 a 50 caracteres.');
        p.displayName = v;
      }
      if (patch.bio !== undefined) {
        if ((patch.bio ?? '').length > 280) throw new Error('Bio pode ter até 280 caracteres.');
        p.bio = patch.bio?.trim() || null;
      }
      if (patch.avatarUrl !== undefined) p.avatarUrl = patch.avatarUrl;
      if (patch.isPrivate !== undefined) {
        // espelha profiles_privacy_change(): ao virar público, pendentes viram aceitos
        if (p.isPrivate && !patch.isPrivate) db.follows.forEach((f) => f.followeeId === ME && (f.status = 'accepted'));
        p.isPrivate = patch.isPrivate;
      }
      if (patch.city !== undefined) db.mySettings.city = patch.city?.trim() || null;
      if (patch.defaultCheckinVisibility) db.mySettings.defaultCheckinVisibility = patch.defaultCheckinVisibility;
      return mySettings();
    },
    async uploadAvatar(photo) {
      await delay(600);
      return photo.uri; // mock: usa o arquivo local
    },
    async block(userId) {
      await delay(200);
      db.blocks.add(userId);
      // espelha blocks_after_insert(): desfaz follows nos dois sentidos
      for (let i = db.follows.length - 1; i >= 0; i--) {
        const f = db.follows[i]!;
        if ((f.followerId === ME && f.followeeId === userId) || (f.followerId === userId && f.followeeId === ME)) db.follows.splice(i, 1);
      }
    },
    async unblock(userId) {
      await delay(200);
      db.blocks.delete(userId);
    },
    async report() {
      await delay(200);
    },
    ...mockProfilesExtra,
    ...mockSuggest,
  },

  messages: mockMessages,
  groups: { ...mockGroups, ...mockGroupsSafety },
  checkins: mockCheckins,
  stories: mockStories,

  social: {
    async listComments(postId) {
      await delay(200);
      const post = db.posts.find((p) => p.id === postId);
      if (!post || !canViewItem(ME, post.authorId, post.visibility)) return [];
      return db.comments
        .filter((c) => c.postId === postId && !db.blocks.has(c.authorId))
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map((c) => toCommentView(c, post.authorId));
    },
    async addComment(postId, body) {
      await delay(250);
      const text = body.trim();
      if (!text || text.length > 500) throw new Error('Comentário precisa ter de 1 a 500 caracteres.');
      const post = db.posts.find((p) => p.id === postId);
      if (!post || !canViewItem(ME, post.authorId, post.visibility)) throw new Error('Você não pode comentar aqui.');
      const c = { id: `cm-${Date.now()}`, postId, authorId: ME, body: text, createdAt: new Date().toISOString() };
      db.comments.push(c);
      post.commentsCount += 1;
      return toCommentView(c, post.authorId);
    },
    async deleteComment(commentId) {
      await delay(200);
      const i = db.comments.findIndex((c) => c.id === commentId);
      if (i < 0) return;
      const c = db.comments[i]!;
      const post = db.posts.find((p) => p.id === c.postId);
      if (c.authorId !== ME && post?.authorId !== ME) throw new Error('Você não pode apagar este comentário.');
      db.comments.splice(i, 1);
      if (post) post.commentsCount = Math.max(0, post.commentsCount - 1);
    },
    async notifications() {
      await delay(250);
      return db.notifications
        .filter((n) => !n.actorId || !db.blocks.has(n.actorId))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((n): NotificationView => ({ ...n, actor: n.actorId ? (profileById(n.actorId) ?? null) : null }));
    },
    async unreadCount() {
      return db.notifications.filter((n) => !n.readAt).length;
    },
    async markAllRead() {
      const t = new Date().toISOString();
      db.notifications.forEach((n) => (n.readAt ??= t));
    },
    subscribe() {
      return () => {};
    },
    async followRequests() {
      await delay(200);
      return db.follows
        .filter((f) => f.followeeId === ME && f.status === 'pending')
        .map((f) => profileById(f.followerId))
        .filter((p): p is UserProfile => !!p);
    },
    async respondFollow(followerId, accept) {
      await delay(250);
      const i = db.follows.findIndex((f) => f.followerId === followerId && f.followeeId === ME && f.status === 'pending');
      if (i < 0) return;
      if (accept) db.follows[i]!.status = 'accepted';
      else db.follows.splice(i, 1);
      db.notifications.forEach((n, k) => n.type === 'follow_request' && n.actorId === followerId && db.notifications.splice(k, 1));
    },
  },
};

function mySettings(): ProfileSettings {
  const p = profileById(ME)!;
  return {
    displayName: p.displayName, bio: p.bio, city: db.mySettings.city, avatarUrl: p.avatarUrl, isPrivate: p.isPrivate,
    defaultCheckinVisibility: db.mySettings.defaultCheckinVisibility, isModerator: db.mySettings.isModerator,
    usernameChangesLeft: 1,
    discreetMode: db.mySettings.discreetMode,
  };
}

function toCommentView(c: (typeof db.comments)[number], postAuthorId: string): CommentView {
  return {
    id: c.id, postId: c.postId, body: c.body, createdAt: c.createdAt, author: profileById(c.authorId)!,
    canDelete: c.authorId === ME || postAuthorId === ME,
  };
}
