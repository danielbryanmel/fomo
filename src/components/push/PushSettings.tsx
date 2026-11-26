import { BellRing, Share, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ToggleRow } from '@/components/form/ToggleRow';
import { Button, Chip, Text, useToast } from '@/components/ui';
import { disablePush, enablePush, getPushPrefs, pushState, setNudges, setPronoun, type Pronoun, type PushState } from '@/features/push/webPush';
import { colors, radius, spacing } from '@/theme';

const HELP: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  'needs-install': 'No iPhone, as notificações só funcionam com o FOMO na Tela de Início: toque em Compartilhar e depois em "Adicionar à Tela de Início". Abra por lá e ative aqui.',
  denied: 'As notificações estão bloqueadas para o FOMO. Libere nos ajustes do navegador (ou do iPhone, em Ajustes > Notificações > FOMO) e volte aqui.',
  unsupported: 'Este navegador não recebe notificações. No celular, use o FOMO pela Tela de Início.',
};

/** Card compacto (tela de Notificações): só aparece enquanto o push não está ligado. */
export function PushPrompt() {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pushState().then(setSt); }, []);
  if (!st || st === 'on' || st === 'unsupported') return null;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}><BellRing size={18} color={colors.background} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Não perca o rolê</Text>
          <Text variant="caption" tone="secondary">
            {st === 'off' ? 'Ative as notificações: mensagens, convites de grupo e quando o rolê tá bombando.' : HELP[st]}
          </Text>
        </View>
      </View>
      {st === 'off' ? (
        <Button
          label="Ativar notificações"
          loading={busy}
          fullWidth
          onPress={async () => {
            setBusy(true);
            try {
              const r = await enablePush();
              setSt(r);
              toast(r === 'on' ? 'Notificações ativadas' : r === 'denied' ? 'Notificações bloqueadas no aparelho' : 'Não ativado', r === 'on' ? 'success' : 'error');
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Não foi possível ativar.', 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : st === 'needs-install' ? (
        <View style={styles.row}><Share size={14} color={colors.textMuted} /><Text variant="caption" tone="muted">Compartilhar → Adicionar à Tela de Início</Text></View>
      ) : null}
    </View>
  );
}

/** Seção das Configurações: push ligado/desligado + cutucadas de fim de semana. */
export function PushSettings() {
  const toast = useToast();
  const [st, setSt] = useState<PushState | null>(null);
  const [nudges, setN] = useState(true);
  const [pronoun, setP] = useState<Pronoun>(null);
  useEffect(() => {
    void pushState().then(setSt);
    void getPushPrefs().then((p) => { setN(p.nudges); setP(p.pronoun); }).catch(() => {});
  }, []);
  const pickPronoun = async (p: Pronoun) => {
    const prev = pronoun;
    setP(p);
    try { await setPronoun(p); } catch { setP(prev); toast('Não foi possível salvar.', 'error'); }
  };
  if (!st) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <ToggleRow
        icon={<BellRing size={18} color={colors.textSecondary} />}
        label="Notificações no celular"
        description={st === 'on' || st === 'off' ? 'Mensagens, convites, lembretes do rolê e o resumo da noite.' : HELP[st]}
        value={st === 'on'}
        onChange={async (v) => {
          try {
            const r = v ? await enablePush() : await disablePush();
            setSt(r);
            if (v && r !== 'on') toast(r === 'denied' ? 'Bloqueado no aparelho. Libere nos ajustes.' : 'Não ativado', 'error');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Não foi possível mudar agora.', 'error');
          }
        }}
      />
      <ToggleRow
        icon={<Sparkles size={18} color={colors.textSecondary} />}
        label="Cutucadas de fim de semana"
        description='Quinta, sexta e sábado à noite, se você não tá em nenhum rolê. Spoiler: a gente provoca. No máximo uma por dia.'
        value={nudges}
        onChange={async (v) => {
          setN(v);
          try { await setNudges(v); } catch { setN(!v); toast('Não foi possível salvar.', 'error'); }
        }}
      />
      {nudges ? (
        <View style={{ gap: spacing.sm, paddingLeft: spacing.xs }}>
          <Text variant="caption" tone="secondary">Como a gente fala com você nas cutucadas? (opcional)</Text>
          <View style={styles.chips}>
            <Chip label="Ele" selected={pronoun === 'ele'} onPress={() => void pickPronoun('ele')} />
            <Chip label="Ela" selected={pronoun === 'ela'} onPress={() => void pickPronoun('ela')} />
            <Chip label="Prefiro não dizer" selected={pronoun === null} onPress={() => void pickPronoun(null)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
