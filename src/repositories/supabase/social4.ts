/**
 * Supabase: check-in seguro, stories de 24 h, sugestões de amizade e "cheguei bem" (migration 0012).
 * Autorização inteira no banco (RLS + RPCs). Aqui só consultas, upload e mapeamento.
 */
import * as Crypto from 'expo-crypto';
import { requireSupabase } from '@/lib/supabase/client';
import type { EventPresence, GroupLocation, PersonSuggestion, Story, StoryGroup } from '@/types/domain';
import type { CheckinsRepository, GroupsRepository, ProfilesRepository, StoriesRepository } from '../types';
import { friendlyError, toProfile } from './mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const sb = () => requireSupabase();
const STORY_URL_TTL = 60 * 60;

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
const toPresence = (j: Row | null): EventPresence => ({ count: j?.count ?? null, few: !!j?.few, me: j?.me ?? null });

export const checkinsRepo: CheckinsRepository = {
  async presence(eventId) {
    return toPresence(check(await sb().rpc('event_presence', { p_event_id: eventId })) as Row);
  },
  async checkIn(eventId, visibility, revealMinutes) {
    return toPresence(check(await sb().rpc('check_in', { p_event_id: eventId, p_visibility: visibility, p_reveal_minutes: revealMinutes })) as Row);
  },
  async checkOut(eventId) {
    const me = await uid();
    check(await sb().from('check_ins').delete().eq('user_id', me).eq('event_id', eventId));
  },
};

export const storiesRepo: StoriesRepository = {
  async tray() {
    const { data: s } = await sb().auth.getSession();
    if (!s.session) return [];
    const groups = (check(await sb().rpc('stories_tray')) ?? []) as Row[];
    const paths = groups.flatMap((g) => (g.stories ?? []).map((x: Row) => x.path as string));
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data } = await sb().storage.from('post-media').createSignedUrls(paths, STORY_URL_TTL);
      (data ?? []).forEach((d) => d.signedUrl && d.path && urls.set(d.path, d.signedUrl));
    }
    return groups.map((g): StoryGroup => ({
      author: toProfile(g.author),
      hasUnseen: !!g.hasUnseen,
      latestAt: g.latestAt,
      stories: (g.stories ?? [])
        .filter((x: Row) => urls.has(x.path))
        .map((x: Row): Story => ({
          id: x.id, photo: { uri: urls.get(x.path)! }, width: x.width ?? 1080, height: x.height ?? 1920, caption: x.caption ?? null,
          isDual: !!x.isDual, visibility: x.visibility, event: x.event ?? null, createdAt: x.createdAt, expiresAt: x.expiresAt,
          seen: !!x.seen, views: x.views ?? null,
        })),
    })).filter((g) => g.stories.length > 0);
  },
  async create(input, onProgress) {
    const me = await uid();
    const id = Crypto.randomUUID();
    const path = `${me}/stories/${id}.jpg`;
    const body = await (await fetch(input.photo.uri)).arrayBuffer();
    onProgress?.(0.2);
    const up = await sb().storage.from('post-media').upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw friendlyError(up.error);
    onProgress?.(0.8);
    try {
      check(await sb().rpc('create_story', {
        p_id: id, p_path: path, p_width: input.photo.width, p_height: input.photo.height,
        p_event_id: input.eventId, p_caption: input.caption, p_visibility: input.visibility, p_dual: input.isDual,
      }));
    } catch (e) {
      await sb().storage.from('post-media').remove([path]); // sem foto órfã
      throw e;
    }
    onProgress?.(1);
  },
  async view(storyId) {
    await sb().rpc('view_story', { p_story: storyId });
  },
  async viewers(storyId) {
    return ((check(await sb().rpc('story_viewers', { p_story: storyId })) ?? []) as Row[]).map((v) => ({ profile: toProfile(v.profile), viewedAt: v.viewedAt }));
  },
  async remove(storyId) {
    const r = check(await sb().from('stories').select('storage_path').eq('id', storyId).maybeSingle()) as Row | null;
    check(await sb().from('stories').delete().eq('id', storyId));
    if (r?.storage_path) await sb().storage.from('post-media').remove([r.storage_path]);
  },
};

export const profilesSuggest: Pick<ProfilesRepository, 'suggestions' | 'setDiscreetMode'> = {
  async setDiscreetMode(on) {
    check(await sb().rpc('set_discreet_mode', { p_on: on }));
  },
  async suggestions(limit = 20) {
    const { data: s } = await sb().auth.getSession();
    if (!s.session) return [];
    return ((check(await sb().rpc('suggested_people', { p_limit: limit })) ?? []) as Row[])
      .map((x): PersonSuggestion => ({ profile: toProfile(x.profile), reason: x.reason }));
  },
};

export const groupsSafety: Pick<GroupsRepository, 'arrivedHome' | 'locations' | 'shareLocation' | 'stopSharing'> = {
  async locations(groupId) {
    return ((check(await sb().rpc('group_locations_json', { p_group: groupId })) ?? []) as Row[]).map((l): GroupLocation => ({
      profile: toProfile(l.profile), latitude: l.latitude, longitude: l.longitude, accuracyM: l.accuracyM ?? null, updatedAt: l.updatedAt, expiresAt: l.expiresAt,
    }));
  },
  async shareLocation(groupId, point, accuracyM, minutes) {
    return check(await sb().rpc('share_group_location', {
      p_group: groupId, p_lat: point.latitude, p_lng: point.longitude,
      p_accuracy: accuracyM == null ? null : Math.round(accuracyM), p_minutes: minutes ?? null,
    })) as string;
  },
  async stopSharing(groupId) {
    const me = await uid();
    check(await sb().from('group_locations').delete().eq('group_id', groupId).eq('user_id', me));
  },
  async arrivedHome(groupId) {
    return check(await sb().rpc('arrived_home', { p_group: groupId })) as number;
  },
};
