/**
 * Implementação real dos repositórios sobre o Supabase.
 * Toda regra de visibilidade/autorização está no banco (RLS + RPCs, ver supabase/migrations).
 * Este arquivo só consulta, monta view models e traduz erros.
 */
import { venuesRepo } from './venues';
import * as Crypto from 'expo-crypto';
import { neighborhoods } from '@/config/neighborhoods';
import { requireSupabase } from '@/lib/supabase/client';
import type { CommentView, NotificationView, PostPhoto, PostView, ProfileSettings, ProfileView, ReviewView, UserProfile } from '@/types/domain';
import type { Repositories } from '../types';
import { demoPhoto, isDemoPath } from '@/lib/demoPhotos';
import { groupsRepo, messagesRepo, profilesExtra } from './social2';
import { checkinsRepo, groupsSafety, profilesSuggest, storiesRepo } from './social4';
import { friendlyError, presenceOf, toCategory, toEventView, toLive, toMapEvent, toPost, toProfile } from './mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const sb = () => requireSupabase();
const PAGE = 15;
const SIGNED_URL_TTL = 60 * 60; // 1 h

async function uid(): Promise<string> {
  const { data } = await sb().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Entre na sua conta para continuar.');
  return id;
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw friendlyError(res.error);
  return res.data;
}

const POST_SELECT = `*,
  author:profiles!posts_author_id_fkey(*),
  event:events(*, category:event_categories(*)),
  category:event_categories(*),
  media:post_media(storage_path, width, height, position),
  check_in:check_ins(status)`;

/** Junta autor, evento, fotos (URLs assinadas), presença e estado "curti/salvei". */
async function hydrate(rows: Row[]): Promise<PostView[]> {
  if (!rows.length) return [];
  const me = await uid();
  const ids = rows.map((r) => r.id);

  // rows de feed() vêm "planas": buscamos o select completo
  const full: Row[] = rows[0]?.author ? rows : ((check(await sb().from('posts').select(POST_SELECT).in('id', ids)) ?? []) as Row[]);
  const byId = new Map(full.map((r) => [r.id, r]));

  const [likes, saves] = await Promise.all([
    sb().from('likes').select('post_id').eq('user_id', me).in('post_id', ids),
    sb().from('saved_posts').select('post_id').eq('user_id', me).in('post_id', ids),
  ]);
  const liked = new Set((likes.data ?? []).map((l: Row) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l: Row) => l.post_id));

  const paths = full.flatMap((r) => (r.media ?? []).map((m: Row) => m.storage_path as string)).filter((p) => !isDemoPath(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await sb().storage.from('post-media').createSignedUrls(paths, SIGNED_URL_TTL);
    (data ?? []).forEach((d) => d.signedUrl && d.path && urls.set(d.path, d.signedUrl));
  }

  return ids
    .map((id) => byId.get(id))
    .filter((r): r is Row => !!r)
    .map((r) => {
      const photos: PostPhoto[] = [...(r.media ?? [])]
        .sort((a: Row, b: Row) => a.position - b.position)
        .filter((m: Row) => urls.has(m.storage_path) || demoPhoto(m.storage_path) !== undefined)
        .map((m: Row) => ({
          source: urls.has(m.storage_path) ? { uri: urls.get(m.storage_path)! } : demoPhoto(m.storage_path)!,
          width: m.width ?? 1080,
          height: m.height ?? 1350,
        }));
      return {
        ...toPost(r),
        author: toProfile(r.author),
        photos,
        presence: presenceOf(r.check_in?.status),
        event: r.event ? toEventView(r.event, false) : null,
        category: r.category ? toCategory(r.category) : null,
        likedByMe: liked.has(r.id),
        savedByMe: saved.has(r.id),
        isMine: r.author_id === me,
      } satisfies PostView;
    });
}

const toReview = (r: Row): ReviewView => ({
  id: r.id, authorId: r.author_id, eventId: r.event_id, rating: r.rating, body: r.body, aspects: r.aspects ?? [],
  helpfulCount: r.helpful_count, createdAt: r.created_at, author: toProfile(r.author),
});

const toSettings = (r: Row): ProfileSettings => ({
  displayName: r.display_name, bio: r.bio, city: r.city, avatarUrl: r.avatar_url, isPrivate: r.is_private,
  defaultCheckinVisibility: r.default_checkin_visibility, isModerator: !!r.is_moderator,
  usernameChangesLeft: Math.max(0, 1 - (r.username_changes ?? 0)),
  discreetMode: !!r.discreet_mode,
});
const SETTINGS_COLS = 'display_name, bio, city, avatar_url, is_private, default_checkin_visibility, is_moderator, username_changes, discreet_mode';

const EVENT_SELECT = '*, category:event_categories(*)';

async function relationshipFor(profile: UserProfile): Promise<ProfileView> {
  const me = await uid();
  if (profile.id === me) {
    return { profile, relationship: { isSelf: true, followStatus: null, followsViewer: false, isBlocked: false, canViewContent: true } };
  }
  const rel = check(await sb().rpc('profile_relationship', { p_target: profile.id })) as Row;
  return {
    profile,
    relationship: {
      isSelf: false,
      followStatus: (rel.followStatus as 'pending' | 'accepted' | null) ?? null,
      followsViewer: !!rel.followsViewer,
      isBlocked: !!rel.isBlocked,
      canViewContent: !!rel.canViewContent,
    },
  };
}

export const supabaseRepositories: Repositories = {
  events: {
    async listCategories() {
      return ((check(await sb().from('event_categories').select('*').order('sort_order')) ?? []) as Row[]).map(toCategory);
    },
    async listNeighborhoods() {
      return neighborhoods;
    },
    async listForMap(q) {
      const rows = check(
        await sb().rpc('events_in_bounds', {
          p_north: q.bounds.north, p_south: q.bounds.south, p_east: q.bounds.east, p_west: q.bounds.west,
          p_origin_lat: q.origin?.latitude ?? null, p_origin_lng: q.origin?.longitude ?? null,
          p_category_slug: q.categorySlug ?? null, p_date: q.date ?? 'today',
          p_max_distance_km: q.maxDistanceKm ?? null, p_price: q.price ?? 'any',
          p_query: q.query?.trim() || null, p_limit: q.limit ?? 100,
        }),
      ) as Row[];
      return rows.map((r) => toMapEvent(r.event));
    },
    async listUpcoming(filters, cursor) {
      const from = cursor ? Number(cursor) : 0;
      let query = sb().from('events').select('*, category:event_categories!inner(*)')
        .eq('status', 'approved').gt('starts_at', new Date(Date.now() - 8 * 3_600_000).toISOString())
        .order('starts_at').range(from, from + PAGE - 1);
      if (filters.categorySlug) query = query.eq('category.slug', filters.categorySlug);
      if (filters.query?.trim()) query = query.ilike('title', `%${filters.query.trim()}%`);
      const rows = check(await query) as Row[];
      return { items: rows.map((r) => toEventView(r, false)), nextCursor: rows.length === PAGE ? String(from + PAGE) : null };
    },
    async getById(id) {
      const row = check(await sb().from('events').select('*, category:event_categories(*)').eq('id', id).maybeSingle()) as Row | null;
      if (!row) return null;
      const me = await uid();
      const saved = await sb().from('saved_events').select('event_id').eq('user_id', me).eq('event_id', id).maybeSingle();
      return toEventView(row, !!saved.data);
    },
    async listReviews(eventId) {
      const rows = check(await sb().from('reviews').select('*, author:profiles!reviews_author_id_fkey(*)').eq('event_id', eventId).order('created_at', { ascending: false }).limit(30)) as Row[];
      return rows.map(toReview);
    },
    async toggleSave(eventId) {
      const me = await uid();
      const existing = await sb().from('saved_events').select('event_id').eq('user_id', me).eq('event_id', eventId).maybeSingle();
      if (existing.data) {
        check(await sb().from('saved_events').delete().eq('user_id', me).eq('event_id', eventId));
        return false;
      }
      check(await sb().from('saved_events').insert({ user_id: me, event_id: eventId }));
      return true;
    },
    async listSaved() {
      const me = await uid();
      const rows = check(await sb().from('saved_events').select('event:events(*, category:event_categories(*))').eq('user_id', me).order('created_at', { ascending: false })) as Row[];
      return rows.filter((r) => r.event).map((r) => toEventView(r.event, true));
    },
    async submit(input) {
      const me = await uid();
      const weeks = Math.min(Math.max(input.repeatWeeks ?? 0, 0), 12);
      const seriesId = weeks > 1 ? Crypto.randomUUID() : null;
      const WEEK_MS = 7 * 86_400_000;
      const rows = Array.from({ length: Math.max(weeks, 1) }, (_, k) => ({
        title: input.title.trim(), description: input.description?.trim() || null, category_id: input.categoryId,
        starts_at: new Date(Date.parse(input.startsAt) + k * WEEK_MS).toISOString(),
        ends_at: input.endsAt ? new Date(Date.parse(input.endsAt) + k * WEEK_MS).toISOString() : null,
        venue_name: input.venueName.trim(), address: input.address?.trim() || null,
        latitude: input.location.latitude, longitude: input.location.longitude,
        price_min_cents: input.priceMinCents, price_max_cents: input.priceMaxCents, ticket_url: input.ticketUrl?.trim() || null,
        created_by: me, series_id: seriesId, // status/patrocínio ficam no padrão; a RLS recusa qualquer outro valor
      }));
      const inserted = check(await sb().from('events').insert(rows).select(EVENT_SELECT)) as Row[];
      return toEventView(inserted[0]!, false);
    },
    async listMine() {
      const me = await uid();
      const rows = check(await sb().from('events').select(EVENT_SELECT).eq('created_by', me).order('created_at', { ascending: false }).limit(50)) as Row[];
      return rows.map((r) => toEventView(r, false));
    },
    async listPending() {
      // RLS: não-moderador só enxerga os próprios pendentes; filtramos para a fila real
      const me = await uid();
      const rows = check(await sb().from('events').select(EVENT_SELECT).eq('status', 'pending').neq('created_by', me).order('created_at').limit(50)) as Row[];
      return rows.map((r) => toEventView(r, false));
    },
    async moderate(eventId, approve) {
      check(await sb().rpc('moderate_event', { p_event_id: eventId, p_approve: approve }));
    },
    async myReview(eventId) {
      const me = await uid();
      const r = check(await sb().from('reviews').select('*, author:profiles!reviews_author_id_fkey(*)').eq('event_id', eventId).eq('author_id', me).maybeSingle()) as Row | null;
      return r ? toReview(r) : null;
    },
    async saveReview(eventId, rating, body, aspects = []) {
      const me = await uid();
      const existing = await sb().from('reviews').select('id').eq('event_id', eventId).eq('author_id', me).maybeSingle();
      const q = existing.data
        ? sb().from('reviews').update({ rating, body: body?.trim() || null, aspects }).eq('id', existing.data.id)
        : sb().from('reviews').insert({ author_id: me, event_id: eventId, rating, body: body?.trim() || null, aspects });
      const r = check(await q.select('*, author:profiles!reviews_author_id_fkey(*)').single()) as Row;
      return toReview(r);
    },
  },

  live: {
    async status(eventId) {
      // sem sessão (ou sessão expirando) o banco nega: mostra "sem relatos" em vez de erro
      const { data: s } = await sb().auth.getSession();
      if (!s.session) return toLive({ eventId, reportsCount: 0 });
      const res = await sb().rpc('live_status', { p_event_id: eventId });
      if (res.error && /permission|jwt|401/i.test(res.error.message)) return toLive({ eventId, reportsCount: 0 });
      return toLive(check(res) as Row);
    },
    async submit(input) {
      const res = check(
        await sb().rpc('submit_live_report', {
          p_event_id: input.eventId, p_crowd: input.crowd, p_vibe: input.vibe, p_music: input.music,
          p_queue: input.queue, p_lat: input.location.latitude, p_lng: input.location.longitude,
        }),
      ) as Row;
      return { accepted: true, xpPending: res.xpPending ?? 0, expiresAt: res.expiresAt, presenceVerified: !!res.presenceVerified, presenceXp: res.presenceXp ?? 0 };
    },
  },

  posts: {
    async feed(tab, cursor) {
      const rows = check(await sb().rpc('feed', { p_tab: tab, p_cursor: cursor ?? null, p_limit: PAGE })) as Row[];
      const items = await hydrate(rows);
      const next = rows.length < PAGE ? null : tab === 'following' ? rows[rows.length - 1]!.created_at : String((cursor ? Number(cursor) : 0) + PAGE);
      return { items, nextCursor: next };
    },
    async getById(id) {
      const rows = check(await sb().from('posts').select(POST_SELECT).eq('id', id)) as Row[];
      return (await hydrate(rows))[0] ?? null;
    },
    async listByAuthor(userId) {
      return hydrate(check(await sb().from('posts').select(POST_SELECT).eq('author_id', userId).order('created_at', { ascending: false }).limit(60)) as Row[]);
    },
    async listByEvent(eventId) {
      return hydrate(check(await sb().from('posts').select(POST_SELECT).eq('event_id', eventId).order('created_at', { ascending: false }).limit(30)) as Row[]);
    },
    async toggleLike(postId) {
      const me = await uid();
      const del = await sb().from('likes').delete().eq('post_id', postId).eq('user_id', me).select('post_id');
      if ((del.data ?? []).length) return false;
      check(await sb().from('likes').insert({ post_id: postId, user_id: me }));
      return true;
    },
    async toggleSave(postId) {
      const me = await uid();
      const del = await sb().from('saved_posts').delete().eq('post_id', postId).eq('user_id', me).select('post_id');
      if ((del.data ?? []).length) return false;
      check(await sb().from('saved_posts').insert({ post_id: postId, user_id: me }));
      return true;
    },
    async listSaved() {
      const me = await uid();
      const rows = check(await sb().from('saved_posts').select('post_id').eq('user_id', me).order('created_at', { ascending: false }).limit(60)) as Row[];
      if (!rows.length) return [];
      return hydrate(check(await sb().from('posts').select(POST_SELECT).in('id', rows.map((r) => r.post_id))) as Row[]);
    },
    async create(input, onProgress) {
      const me = await uid();
      const postId = Crypto.randomUUID();
      const uploaded: string[] = [];
      try {
        // 1) fotos → Storage (pasta do autor/post; a RLS do bucket confere o dono)
        for (let i = 0; i < input.photos.length; i++) {
          const ph = input.photos[i]!;
          const path = `${me}/${postId}/${i}-${Crypto.randomUUID().slice(0, 8)}.jpg`;
          const body = await (await fetch(ph.uri)).arrayBuffer();
          const up = await sb().storage.from('post-media').upload(path, body, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw up.error;
          uploaded.push(path);
          onProgress?.((i + 1) / (input.photos.length + 1));
        }
        // 2) post + mídia + presença declarada, atômico no servidor
        check(
          await sb().rpc('create_post', {
            p_post_id: postId,
            p_body: input.body,
            p_media: input.photos.map((ph, i) => ({ path: uploaded[i], width: ph.width, height: ph.height })),
            p_event_id: input.eventId,
            p_place_name: input.placeName,
            p_experience_date: input.experienceDate,
            p_category_id: input.categoryId,
            p_rating: input.rating,
            p_visibility: input.visibility,
            p_declare_presence: input.declarePresence,
          }),
        );
        onProgress?.(1);
        const created = await supabaseRepositories.posts.getById(postId);
        if (!created) throw new Error('Publicado, mas não foi possível carregar.');
        return created;
      } catch (e) {
        // não deixa fotos órfãs no Storage
        if (uploaded.length) await sb().storage.from('post-media').remove(uploaded);
        throw friendlyError(e);
      }
    },
    async remove(postId) {
      const media = check(await sb().from('post_media').select('storage_path').eq('post_id', postId)) as Row[];
      check(await sb().from('posts').delete().eq('id', postId));
      if (media.length) await sb().storage.from('post-media').remove(media.map((m) => m.storage_path));
    },
    async report(postId, reason) {
      const me = await uid();
      const allowed = ['spam', 'inapropriado', 'falso', 'assedio', 'violencia', 'outro'];
      const res = await sb().from('reports').insert({ reporter_id: me, target_type: 'post', target_id: postId, reason: allowed.includes(reason) ? reason : 'outro' });
      // denúncia repetida do mesmo item não é erro para quem denuncia
      if (res.error && !/duplicate|23505/.test(res.error.message)) throw friendlyError(res.error);
    },
  },

  profiles: {
    async me() {
      const me = await uid();
      const row = check(await sb().from('profiles').select('*').eq('id', me).single()) as Row;
      return relationshipFor(toProfile(row));
    },
    async getByUsername(username) {
      const row = check(await sb().from('profiles').select('*').ilike('username', username).maybeSingle()) as Row | null;
      return row ? relationshipFor(toProfile(row)) : null;
    },
    async listReviews(userId) {
      const rows = check(await sb().from('reviews').select('*, author:profiles!reviews_author_id_fkey(*)').eq('author_id', userId).order('created_at', { ascending: false }).limit(30)) as Row[];
      return rows.map(toReview);
    },
    async toggleFollow(userId) {
      const me = await uid();
      const del = await sb().from('follows').delete().eq('follower_id', me).eq('followee_id', userId).select('status');
      if ((del.data ?? []).length) return null;
      // status é decidido pelo servidor (público → accepted, privado → pending)
      const ins = check(await sb().from('follows').insert({ follower_id: me, followee_id: userId }).select('status').single()) as Row;
      return ins.status;
    },
    async settings() {
      const me = await uid();
      return toSettings(check(await sb().from('profiles').select(SETTINGS_COLS).eq('id', me).single()) as Row);
    },
    async updateSettings(patch) {
      const me = await uid();
      const upd: Row = {};
      if (patch.displayName !== undefined) upd.display_name = patch.displayName.trim();
      if (patch.bio !== undefined) upd.bio = patch.bio?.trim() || null;
      if (patch.city !== undefined) upd.city = patch.city?.trim() || null;
      if (patch.avatarUrl !== undefined) upd.avatar_url = patch.avatarUrl;
      if (patch.isPrivate !== undefined) upd.is_private = patch.isPrivate;
      if (patch.defaultCheckinVisibility !== undefined) upd.default_checkin_visibility = patch.defaultCheckinVisibility;
      const row = check(await sb().from('profiles').update(upd).eq('id', me)
        .select(SETTINGS_COLS).single()) as Row;
      return toSettings(row);
    },
    async uploadAvatar(photo) {
      const me = await uid();
      const path = `${me}/${Crypto.randomUUID().slice(0, 12)}.jpg`;
      const body = await (await fetch(photo.uri)).arrayBuffer();
      const up = await sb().storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw friendlyError(up.error);
      return sb().storage.from('avatars').getPublicUrl(path).data.publicUrl;
    },
    async block(userId) {
      const me = await uid();
      const res = await sb().from('blocks').insert({ blocker_id: me, blocked_id: userId });
      if (res.error && !/duplicate|23505/.test(res.error.message)) throw friendlyError(res.error);
    },
    async unblock(userId) {
      const me = await uid();
      check(await sb().from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId));
    },
    async report(userId, reason) {
      const me = await uid();
      const res = await sb().from('reports').insert({ reporter_id: me, target_type: 'profile', target_id: userId, reason });
      if (res.error && !/duplicate|23505/.test(res.error.message)) throw friendlyError(res.error);
    },
    ...profilesExtra,
    ...profilesSuggest,
  },

  venues: venuesRepo,
  messages: messagesRepo,
  groups: { ...groupsRepo, ...groupsSafety },
  checkins: checkinsRepo,
  stories: storiesRepo,

  social: {
    async listComments(postId) {
      const me = await uid();
      const [rows, post] = await Promise.all([
        sb().from('comments').select('id, post_id, body, created_at, author_id, author:profiles!comments_author_id_fkey(*)').eq('post_id', postId).order('created_at').limit(200),
        sb().from('posts').select('author_id').eq('id', postId).maybeSingle(),
      ]);
      const postAuthor = post.data?.author_id;
      return (check(rows) as Row[]).map((r) => toComment(r, me, postAuthor));
    },
    async addComment(postId, body) {
      const me = await uid();
      const r = check(await sb().from('comments').insert({ post_id: postId, author_id: me, body: body.trim() })
        .select('id, post_id, body, created_at, author_id, author:profiles!comments_author_id_fkey(*)').single()) as Row;
      return toComment(r, me, null);
    },
    async deleteComment(commentId) {
      check(await sb().from('comments').delete().eq('id', commentId));
    },
    async notifications() {
      const rows = check(await sb().from('notifications')
        .select('id, type, entity_type, entity_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(*)')
        .order('created_at', { ascending: false }).limit(60)) as Row[];
      // nome do grupo nas notificações de grupo ("vai no Sextou no Baile"); RLS só devolve grupos de que faço parte
      const gids = [...new Set(rows.filter((r) => r.entity_type === 'group' && r.entity_id).map((r) => r.entity_id as string))];
      const names = new Map<string, string>();
      if (gids.length) {
        const { data } = await sb().from('groups').select('id, name').in('id', gids);
        (data ?? []).forEach((g: Row) => names.set(g.id, g.name));
      }
      return rows.map((r): NotificationView => ({
        id: r.id, type: r.type, actor: r.actor ? toProfile(r.actor) : null, entityType: r.entity_type,
        entityId: r.entity_id, readAt: r.read_at, createdAt: r.created_at,
        entityLabel: r.entity_type === 'group' ? (names.get(r.entity_id) ?? null) : null,
      }));
    },
    async unreadCount() {
      const { count } = await sb().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      return count ?? 0;
    },
    async markAllRead() {
      check(await sb().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null));
    },
    subscribe(onChange) {
      let ch: ReturnType<ReturnType<typeof sb>['channel']> | null = null;
      let closed = false;
      void uid().then((me) => {
        if (closed) return;
        // Realtime respeita a RLS de SELECT: só chegam as notificações do próprio usuário
        ch = sb().channel(`notif:${me}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, () => onChange())
          .subscribe();
      }).catch(() => {});
      return () => {
        closed = true;
        if (ch) void sb().removeChannel(ch);
      };
    },
    async followRequests() {
      const me = await uid();
      const rows = check(await sb().from('follows').select('follower:profiles!follows_follower_id_fkey(*)')
        .eq('followee_id', me).eq('status', 'pending').order('created_at', { ascending: false })) as Row[];
      return rows.filter((r) => r.follower).map((r) => toProfile(r.follower));
    },
    async respondFollow(followerId, accept) {
      const me = await uid();
      const q = sb().from('follows');
      check(accept
        ? await q.update({ status: 'accepted' }).eq('follower_id', followerId).eq('followee_id', me).eq('status', 'pending')
        : await q.delete().eq('follower_id', followerId).eq('followee_id', me).eq('status', 'pending'));
    },
  },
};

function toComment(r: Row, me: string, postAuthor: string | null | undefined): CommentView {
  return {
    id: r.id, postId: r.post_id, body: r.body, createdAt: r.created_at, author: toProfile(r.author),
    canDelete: r.author_id === me || postAuthor === me,
  };
}
