import { router } from 'expo-router';
import { Screen, StateView } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <StateView
        title="Esse rolê não existe"
        description="O link pode estar quebrado ou o conteúdo foi removido."
        actionLabel="Voltar para Explorar"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
