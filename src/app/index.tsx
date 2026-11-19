import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Logo, Text } from '@/components/ui';
import { onboardingRoute, useSession } from '@/store/session';
import { colors } from '@/theme';

/**
 * A1 · Splash — enquanto a sessão carrega, mostra a marca.
 * Depois decide o caminho (fluxo_navegacao.mmd):
 * sem sessão → Entrar · termos novos → A5 · sem perfil mínimo → P1 · tudo ok → Descobrir
 */
export default function Splash() {
  const { ready, signedIn, termsAccepted, profileComplete, missing, deletionAt } = useSession();

  if (ready) {
    if (!signedIn) return <Redirect href="/entrar" />;
    if (deletionAt) return <Redirect href="/conta-em-exclusao" />;
    if (!termsAccepted) return <Redirect href="/termos" />;
    if (!profileComplete) return <Redirect href={onboardingRoute(missing)} />;
    return <Redirect href="/descobrir" />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.brand.red + 'CC', colors.brand.red + '33', 'transparent']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <Logo size={40} />
      <Text variant="overline" color={colors.text.secondary} style={{ marginTop: 12 }}>
        Encontre seu parceiro de treino
      </Text>
      <Text variant="caption" color={colors.text.muted} style={styles.version}>
        v1.0 · MVP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.base, alignItems: 'center', justifyContent: 'center' },
  version: { position: 'absolute', bottom: 48 },
});
