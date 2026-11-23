/**
 * MOCK de busca, seguidores, direct e grupos — espelha as regras do banco (0010) para o
 * modo demonstração sem Supabase. Não é segurança, é simulação.
 */
import * as db from '@/mocks/data';
import type { ConversationPreview, GroupStatus, GroupView, Message, UserProfile } from '@/types/domain';
import type { GroupsRepository, MessagesRepository, ProfilesRepository } from '../types';

const ME = db.CURRENT_USER_ID;
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const byId = (id: string) => db.profiles.find((p) => p.id === id);
let usernameChanges = 0;

const convs: { id: string; members: string[]; lastRead: Record<string, string> }[] = [
  { id: 'cv-1', members: [ME, 'u-lia'], lastRead: { [ME]: new Date(0).toISOString() } },
];
const msgs: Message[] = [
  { id: 'm-1', conversationId: 'cv-1', senderId: 'u-lia', body: 'Vai no Baile da Lua hoje?', createdAt: new Date(Date.now() - 20 * 60_000).toISOString() },
];
const listeners = new Map<string, Set<(m: Message) => void>>();

type Poll = { id: string; question: string; options: string[]; votes: Map<string, number>; createdBy: string; createdAt: string };
type G = { id: string; eventId: string; ownerId: string; name: string; createdAt: string; members: Map<string, GroupStatus>; polls?: Poll[] };
const groups: G[] = [
  { id: 'g-1', eventId: 'e-1', ownerId: 'u-lia', name: 'Sextou no Baile', createdAt: new Date().toISOString(),
    members: new Map<string, GroupStatus>([['u-lia', 'going'], ['u-teo', 'going'], ['u-caio', 'maybe'], [ME, 'invited']]),
    polls: [{ id: 'pl-1', question: 'Onde a gente esquenta?', options: ['Bar da esquina', 'Casa da Lia'], votes: new Map([['u-lia', 1], ['u-teo', 1]]), createdBy: 'u-lia', createdAt: new Date().toISOString() }] },
];

function groupView(g: G): GroupView {
  const e = db.events.find((x) => x.id === g.eventId)!;
  const counts = { going: 0, maybe: 0, invited: 0, declined: 0 } as Record<GroupStatus, number>;
  const members = [...g.members].map(([uid, status]) => {
    counts[status] += 1;
    return { status, profile: byId(uid)! };
  });
  const order: GroupStatus[] = ['going', 'maybe', 'invited', 'declined'];
  members.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return {
    id: g.id, name: g.name, ownerId: g.ownerId, createdAt: g.createdAt, counts, members, myStatus: g.members.get(ME) ?? null,
    event: { id: e.id, title: e.title, venueName: e.venueName, startsAt: e.startsAt, endsAt: e.endsAt },
    polls: (g.polls ?? []).map((p) => ({
      id: p.id, question: p.question, options: p.options, createdBy: p.createdBy, createdAt: p.createdAt,
      votes: p.options.map((_, i) => [...p.votes.values()].filter((v) => v === i).length),
      myVote: p.votes.get(ME) ?? null,
    })),
  };
}

export const mockProfilesExtra: Pick<ProfilesRepository, 'changeUsername' | 'search' | 'followers' | 'following' | 'removeFollower'> = {
  async changeUsername(username) {
    await delay();
    const u = username.trim().toLowerCase();
    const me = byId(ME)!;
    if (!/^[a-z0-9_.]{3,30}$/.test(u)) throw new Error('Use de 3 a 30 letras minúsculas, números, ponto ou _.');
    if (db.profiles.some((p) => p.id !== ME && p.username === u)) throw new Error('Esse @ já está em uso.');
    if (usernameChanges >= 1) throw new Error('Você já usou sua troca grátis de @. Novas trocas custarão R$ 9,90 (em breve).');
    me.username = u;
    usernameChanges += 1;
    return me;
  },
  async search(query) {
    await delay();
    const q = query.trim().replace(/^@/, '').toLowerCase();
    if (q.length < 2) return [];
    return db.profiles.filter((p) => p.username.includes(q) || p.displayName.toLowerCase().includes(q));
  },
  async followers(userId) {
    await delay();
    return db.follows.filter((f) => f.followeeId === userId && f.status === 'accepted').map((f) => byId(f.followerId)).filter((p): p is UserProfile => !!p);
  },
  async following(userId) {
    await delay();
    return db.follows.filter((f) => f.followerId === userId && f.status === 'accepted').map((f) => byId(f.followeeId)).filter((p): p is UserProfile => !!p);
  },
  async removeFollower(userId) {
    await delay();
    const i = db.follows.findIndex((f) => f.followerId === userId && f.followeeId === ME);
    if (i >= 0) db.follows.splice(i, 1);
  },
};

export const mockMessages: MessagesRepository = {
  async inbox() {
    await delay();
    return convs
      .filter((c) => c.members.includes(ME) && msgs.some((m) => m.conversationId === c.id))
      .map((c): ConversationPreview => {
        const last = msgs.filter((m) => m.conversationId === c.id).at(-1)!;
        return {
          id: c.id, other: byId(c.members.find((m) => m !== ME)!) ?? null, lastAt: last.createdAt,
          last: { body: last.body, senderId: last.senderId, createdAt: last.createdAt },
          unread: last.senderId !== ME && last.createdAt > (c.lastRead[ME] ?? ''),
          iFollow: db.follows.some((f) => f.followerId === ME && f.followeeId === c.members.find((m) => m !== ME) && f.status === 'accepted'),
          replied: msgs.some((m) => m.conversationId === c.id && m.senderId === ME),
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },
  async open(userId) {
    await delay(150);
    let c = convs.find((x) => x.members.length === 2 && x.members.includes(ME) && x.members.includes(userId));
    if (!c) {
      c = { id: `cv-${Date.now()}`, members: [ME, userId], lastRead: {} };
      convs.push(c);
    }
    return c.id;
  },
  async peer(conversationId) {
    const c = convs.find((x) => x.id === conversationId);
    return c ? (byId(c.members.find((m) => m !== ME)!) ?? null) : null;
  },
  async list(conversationId) {
    await delay(150);
    return msgs.filter((m) => m.conversationId === conversationId);
  },
  async send(conversationId, body) {
    await delay(120);
    const m: Message = { id: `m-${Date.now()}`, conversationId, senderId: ME, body: body.trim(), createdAt: new Date().toISOString() };
    msgs.push(m);
    listeners.get(conversationId)?.forEach((fn) => fn(m));
    return m;
  },
  async markRead(conversationId) {
    const c = convs.find((x) => x.id === conversationId);
    if (c) c.lastRead[ME] = new Date().toISOString();
  },
  subscribe(conversationId, onMessage) {
    const set = listeners.get(conversationId) ?? new Set();
    set.add(onMessage);
    listeners.set(conversationId, set);
    return () => set.delete(onMessage);
  },
};

export const mockGroups: GroupsRepository = {
  async mine() {
    await delay();
    return groups.filter((g) => g.members.has(ME) && g.members.get(ME) !== 'declined').map(groupView);
  },
  async get(groupId) {
    await delay(150);
    const g = groups.find((x) => x.id === groupId);
    return g && g.members.has(ME) ? groupView(g) : null;
  },
  async create(eventId, name, invitees) {
    await delay(250);
    const g: G = { id: `g-${Date.now()}`, eventId, ownerId: ME, name: name.trim(), createdAt: new Date().toISOString(), members: new Map([[ME, 'going']]) };
    invitees.forEach((u) => u !== ME && g.members.set(u, 'invited'));
    groups.push(g);
    return g.id;
  },
  async respond(groupId, status) {
    await delay(150);
    const g = groups.find((x) => x.id === groupId);
    if (!g || !g.members.has(ME)) throw new Error('Você não foi convidado para esse grupo.');
    g.members.set(ME, status);
  },
  async invite(groupId, invitees) {
    await delay(150);
    const g = groups.find((x) => x.id === groupId)!;
    let n = 0;
    invitees.forEach((u) => {
      if (!g.members.has(u)) {
        g.members.set(u, 'invited');
        n++;
      }
    });
    return n;
  },
  async leave(groupId) {
    groups.find((x) => x.id === groupId)?.members.delete(ME);
  },
  async createPoll(groupId, question, options) {
    await delay(150);
    const g = groups.find((x) => x.id === groupId);
    const opts = options.map((o) => o.trim()).filter(Boolean).slice(0, 4);
    if (!g || opts.length < 2) throw new Error('A enquete precisa de pergunta e pelo menos 2 opções.');
    (g.polls ??= []).unshift({ id: `pl-${Date.now()}`, question: question.trim(), options: opts, votes: new Map(), createdBy: ME, createdAt: new Date().toISOString() });
  },
  async vote(pollId, option) {
    await delay(100);
    const p = groups.flatMap((g) => g.polls ?? []).find((x) => x.id === pollId);
    if (p) p.votes.set(ME, option);
  },
  async friendsGoing(eventId) {
    await delay(150);
    const ids = new Set<string>();
    groups.filter((g) => g.eventId === eventId && g.members.has(ME)).forEach((g) => g.members.forEach((s, u) => s === 'going' && u !== ME && ids.add(u)));
    return [...ids].map((u) => byId(u)!).filter(Boolean) as UserProfile[];
  },
};
