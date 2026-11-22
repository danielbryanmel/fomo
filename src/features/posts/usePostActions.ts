import { useState } from 'react';
import { repositories } from '@/repositories';
import { publicUrl, shareContent } from '@/lib/external';
import { useToast } from '@/components/ui/Toast';
import type { PostView } from '@/types/domain';

/**
 * Ações de publicação com atualização otimista e rollback em caso de erro.
 * `onChange` recebe o post atualizado; `onRemoved` é chamado após exclusão.
 */
export function usePostActions(post: PostView, onChange: (p: PostView) => void, onRemoved?: (id: string) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    const prev = post;
    const liked = !post.likedByMe;
    onChange({ ...post, likedByMe: liked, likesCount: post.likesCount + (liked ? 1 : -1) });
    try {
      await repositories.posts.toggleLike(post.id);
    } catch {
      onChange(prev);
      toast('Não foi possível curtir agora.', 'error');
    }
  }

  async function toggleSave() {
    const prev = post;
    const saved = !post.savedByMe;
    onChange({ ...post, savedByMe: saved });
    try {
      await repositories.posts.toggleSave(post.id);
      toast(saved ? 'Salvo' : 'Removido dos salvos', 'success');
    } catch {
      onChange(prev);
      toast('Não foi possível salvar agora.', 'error');
    }
  }

  async function share() {
    const ok = await shareContent(`Rolê de @${post.author.username} no FOMO`, publicUrl(`/post/${post.id}`));
    if (!ok) toast('Compartilhamento indisponível neste dispositivo.');
  }

  async function report(reason = 'inapropriado') {
    setBusy(true);
    try {
      await repositories.posts.report(post.id, reason);
      toast('Denúncia enviada. Obrigado por avisar.', 'success');
    } catch {
      toast('Não foi possível enviar a denúncia.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await repositories.posts.remove(post.id);
      onRemoved?.(post.id);
      toast('Publicação excluída', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível excluir.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return { toggleLike, toggleSave, share, report, remove, busy };
}
