/**
 * Supabase: busca de pessoas, seguidores/seguindo, direct e grupos (migration 0010).
 * Autorização inteira no banco (RLS + RPCs). Aqui só consultas e mapeamento.
 */
import { requireSupabase } from '@/lib/supabase/client';
import type { ConversationPreview, GroupView, Message, UserProfile } from '@/types/domain';
import type { GroupsRepository, MessagesRepository, ProfilesRepository } from '../types';
import { friendlyError, toProfile } from './mappers';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const sb = () => requireSupabase();

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

const toMessage = (r: Row): Message => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at });
const toGroup = (j: Row): GroupView => ({
  ...(j as GroupView),
  members: (j.members ?? []).map((m: Row) => ({ status: m.status, profile: toProfile(m.profile) })),
  polls: (j.polls ?? []).map((p: Row) => ({ ...p, votes: (p.votes ?? []).map(Number), myVote: p.myVote ?? null })),
});
/** Escapa curingas e separadores do filtro PostgREST; limita o tamanho. */
const likeTerm = (q: string) => `*${q.trim().slice(0, 40).replace(/[%_*,().\\]/g, ' ').trim()}*`;

export const profilesExtra: Pick<ProfilesRepository, 'changeUsername' | 'search' | 'followers' | 'following' | 'removeFollower'> = {
  async changeUsername(username) {
    return toProfile(check(await sb().rpc('change_username', { p_username: username })) as Row);
  },
  async search(query) {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) return [];
    const t = likeTerm(q);
    const rows = check(await sb().from('profiles').select('*').or(`username.ilike.${t},display_name.ilike.${t}`)
      .eq('is_demo', false).order('followers_count', { ascending: false }).limit(25)) as Row[];
    return rows.map(toProfile);
  },
  async followers(userId) {
    const rows = check(await sb().from('follows').select('p:profiles!follows_follower_id_fkey(*)')
      .eq('followee_id', userId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(200)) as Row[];
    return rows.filter((r) => r.p).map((r) => toProfile(r.p));
  },
  async following(userId) {
    const rows = check(await sb().from('follows').select('p:profiles!follows_followee_id_fkey(*)')
      .eq('follower_id', userId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(200)) as Row[];
    return rows.filter((r) => r.p).map((r) => toProfile(r.p));
  },
  async removeFollower(userId) {
    const me = await uid();
    check(await sb().from('follows').delete().eq('follower_id', userId).eq('followee_id', me));
  },
};

export const messagesRepo: MessagesRepository = {
  async inbox() {
    const list = (check(await sb().rpc('inbox')) ?? []) as Row[];
    return list.map((c): ConversationPreview => ({ id: c.id, lastAt: c.lastAt, unread: !!c.unread, last: c.last ?? null, other: c.other ? toProfile(c.other) : null, iFollow: !!c.iFollow, replied: !!c.replied }));
  },
  async open(userId) {
    return check(await sb().rpc('start_conversation', { p_other: userId })) as string;
  },
  async peer(conversationId) {
    const me = await uid();
    const r = check(await sb().from('conversation_members').select('p:profiles(*)').eq('conversation_id', conversationId).neq('user_id', me).limit(1).maybeSingle()) as Row | null;
    return r?.p ? (toProfile(r.p) as UserProfile) : null;
  },
  async list(conversationId) {
    const rows = check(await sb().from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(200)) as Row[];
    return rows.reverse().map(toMessage);
  },
  async send(conversationId, body) {
    const me = await uid();
    return toMessage(check(await sb().from('messages').insert({ conversation_id: conversationId, sender_id: me, body: body.trim() }).select('*').single()) as Row);
  },
  async markRead(conversationId) {
    const me = await uid();
    const now = new Date().toISOString();
    await sb().from('conversation_members').update({ last_read_at: now }).eq('conversation_id', conversationId).eq('user_id', me);
    await sb().from('notifications').update({ read_at: now }).eq('type', 'message').eq('entity_id', conversationId).is('read_at', null);
  },
  subscribe(conversationId, onMessage) {
    const ch = sb().channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) => onMessage(toMessage(p.new as Row)))
      .subscribe();
    return () => void sb().removeChannel(ch);
  },
};

export const groupsRepo: GroupsRepository = {
  async mine() {
    return ((check(await sb().rpc('my_groups')) ?? []) as Row[]).map(toGroup);
  },
  async get(groupId) {
    const j = check(await sb().rpc('group_json', { p_group: groupId })) as Row | null;
    return j ? toGroup(j) : null;
  },
  async create(eventId, name, invitees) {
    return check(await sb().rpc('create_group', { p_event_id: eventId, p_name: name.trim(), p_invitees: invitees })) as string;
  },
  async respond(groupId, status) {
    check(await sb().rpc('respond_group', { p_group: groupId, p_status: status }));
  },
  async invite(groupId, invitees) {
    return check(await sb().rpc('invite_to_group', { p_group: groupId, p_invitees: invitees })) as number;
  },
  async leave(groupId) {
    const me = await uid();
    check(await sb().from('group_members').delete().eq('group_id', groupId).eq('user_id', me));
  },
  async createPoll(groupId, question, options) {
    check(await sb().rpc('create_poll', { p_group: groupId, p_question: question.trim(), p_options: options }));
  },
  async vote(pollId, option) {
    check(await sb().rpc('vote_poll', { p_poll: pollId, p_option: option }));
  },
  async friendsGoing(eventId) {
    const { data } = await sb().auth.getSession();
    if (!data.session) return [];
    return ((check(await sb().rpc('event_friends', { p_event_id: eventId })) ?? []) as Row[]).map(toProfile);
  },
};
