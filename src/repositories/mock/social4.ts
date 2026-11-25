/**
 * MOCK de check-in seguro, stories, sugestões e "cheguei bem" — espelha as regras do banco (0012)
 * para o modo demonstração. Não é segurança, é simulação.
 */
import { demoPhoto } from '@/lib/demoPhotos';
import * as db from '@/mocks/data';
import type { CheckinVisibility, EventPresence, GroupLocation, Story, StoryGroup } from '@/types/domain';
import type { CheckinsRepository, GroupsRepository, ProfilesRepository, StoriesRepository } from '../types';

const ME = db.CURRENT_USER_ID;
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const byId = (id: string) => db.profiles.find((p) => p.id === id)!;

const checkins = new Map<string, Map<string, { visibility: CheckinVisibility; revealAt: string | null; createdAt: string }>>();
// rolê com gente suficiente para o número aparecer
checkins.set('e-1', new Map([['u-lia', { visibility: 'public', revealAt: null, createdAt: new Date().toISOString() }], ['u-teo', { visibility: 'private', revealAt: null, createdAt: new Date().toISOString() }], ['u-caio', { visibility: 'friends', revealAt: null, createdAt: new Date().toISOString() }]]));

function presence(eventId: string): EventPresence {
  const m = checkins.get(eventId) ?? new Map();
  const n = m.size;
  const mine = m.get(ME);
  return { count: n >= 3 ? n : null, few: n > 0 && n < 3, me: mine ? { ...mine, status: 'declared' } : null };
}

export const mockCheckins: CheckinsRepository = {
  async presence(eventId) {
    await delay(120);
    return presence(eventId);
  },
  async checkIn(eventId, visibility, revealMinutes) {
    await delay();
    const m = checkins.get(eventId) ?? new Map();
    m.set(ME, { visibility, revealAt: revealMinutes > 0 ? new Date(Date.now() + revealMinutes * 60_000).toISOString() : null, createdAt: new Date().toISOString() });
    checkins.set(eventId, m);
    return presence(eventId);
  },
  async checkOut(eventId) {
    await delay(120);
    checkins.get(eventId)?.delete(ME);
  },
};

const PHOTO = (seed: number) => demoPhoto(`demo/night-${seed}.jpg`)!;
const stories: (Story & { authorId: string; viewers: string[] })[] = [
  { id: 'st-1', authorId: 'u-lia', photo: PHOTO(1), width: 1080, height: 1920, caption: 'esquenta tá on', isDual: true, visibility: 'followers',
    event: { id: 'e-1', title: 'Baile da Lua' }, createdAt: new Date(Date.now() - 40 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 23 * 3600_000).toISOString(), seen: false, liked: false, views: null, likes: null, viewers: [] },
  { id: 'st-2', authorId: 'u-teo', photo: PHOTO(4), width: 1080, height: 1920, caption: 'vinil + drink da casa', isDual: false, visibility: 'public',
    event: null, createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(), expiresAt: new Date(Date.now() + 21 * 3600_000).toISOString(), seen: false, liked: false, views: null, likes: null, viewers: [] },
];

export const mockStories: StoriesRepository = {
  async tray() {
    await delay();
    const now = Date.now();
    const live = stories.filter((s) => new Date(s.expiresAt).getTime() > now);
    const authors = [...new Set(live.map((s) => s.authorId))];
    return authors
      .map((a): StoryGroup => {
        const items = live.filter((s) => s.authorId === a).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
        return {
          author: byId(a),
          stories: items.map(({ authorId, viewers, ...s }) => ({ ...s, seen: s.seen || viewers.includes(ME), views: authorId === ME ? viewers.length : null })),
          hasUnseen: a !== ME && items.some((s) => !s.viewers.includes(ME)),
          latestAt: items.at(-1)!.createdAt,
        };
      })
      .sort((x, y) => Number(y.author.id === ME) - Number(x.author.id === ME) || Number(y.hasUnseen) - Number(x.hasUnseen) || y.latestAt.localeCompare(x.latestAt));
  },
  async create(input, onProgress) {
    onProgress?.(0.5);
    await delay(400);
    const ev = input.eventId ? db.events.find((e) => e.id === input.eventId) : null;
    stories.push({
      id: `st-${Date.now()}`, authorId: ME, photo: { uri: input.photo.uri }, width: input.photo.width, height: input.photo.height,
      caption: input.caption, isDual: input.isDual, visibility: input.visibility, event: ev ? { id: ev.id, title: ev.title } : null,
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(), seen: true, liked: false, views: 0, likes: 0, viewers: [],
    });
    onProgress?.(1);
  },
  async view(storyId) {
    const s = stories.find((x) => x.id === storyId);
    if (s && s.authorId !== ME && !s.viewers.includes(ME)) s.viewers.push(ME);
  },
  async viewers(storyId) {
    await delay(120);
    const s = stories.find((x) => x.id === storyId);
    return s && s.authorId === ME ? s.viewers.map((v) => ({ profile: byId(v), viewedAt: new Date().toISOString(), liked: false })) : [];
  },
  async like(storyId) {
    const s = stories.find((x) => x.id === storyId);
    if (!s) return false;
    s.liked = !s.liked;
    return s.liked;
  },
  async reply(storyId, body) {
    await delay(200);
    if (!body.trim()) throw new Error('Escreva uma mensagem.');
    const s = stories.find((x) => x.id === storyId);
    if (!s) throw new Error('Story indisponível.');
    return `cv-story-${s.authorId}`;
  },
  async remove(storyId) {
    const i = stories.findIndex((x) => x.id === storyId && x.authorId === ME);
    if (i >= 0) stories.splice(i, 1);
  },
};

export const mockSuggest: Pick<ProfilesRepository, 'suggestions' | 'setDiscreetMode'> = {
  async setDiscreetMode(on) {
    await delay();
    db.mySettings.discreetMode = on;
    if (on) {
      db.mySettings.defaultCheckinVisibility = 'private';
      checkins.forEach((m) => { const c = m.get(ME); if (c) c.visibility = 'private'; });
    }
  },
  async suggestions(limit = 20) {
    await delay();
    const following = new Set(db.follows.filter((f) => f.followerId === ME).map((f) => f.followeeId));
    return db.profiles
      .filter((p) => p.id !== ME && !following.has(p.id))
      .slice(0, limit)
      .map((p, i) => ({
        profile: p,
        reason: db.follows.some((f) => f.followerId === p.id && f.followeeId === ME) ? 'Segue você' : i % 2 ? '2 amigos em comum' : 'Em alta no FOMO',
      }));
  },
};

const locs = new Map<string, GroupLocation[]>([
  ['g-1', [{ profile: byId('u-lia'), latitude: -23.5262, longitude: -46.6662, accuracyM: 25, updatedAt: new Date(Date.now() - 2 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 50 * 60_000).toISOString() }]],
]);

export const mockGroupsSafety: Pick<GroupsRepository, 'arrivedHome' | 'locations' | 'shareLocation' | 'stopSharing'> = {
  async arrivedHome() {
    await delay();
    return 3;
  },
  async locations(groupId) {
    await delay(120);
    return (locs.get(groupId) ?? []).filter((l) => new Date(l.expiresAt).getTime() > Date.now());
  },
  async shareLocation(groupId, point, accuracyM, minutes) {
    await delay(120);
    const list = locs.get(groupId) ?? [];
    const mine = list.find((l) => l.profile.id === ME);
    if (!mine && !minutes) throw new Error('Escolha por quanto tempo compartilhar.');
    const expiresAt = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : mine!.expiresAt;
    const next = { profile: byId(ME), ...point, accuracyM, updatedAt: new Date().toISOString(), expiresAt };
    locs.set(groupId, [next, ...list.filter((l) => l.profile.id !== ME)]);
    return expiresAt;
  },
  async stopSharing(groupId) {
    locs.set(groupId, (locs.get(groupId) ?? []).filter((l) => l.profile.id !== ME));
  },
};
