import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { Avatar } from '@/features/discovery/profile-card';
import { useDiscovery } from '@/store/discovery';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** D7 · US-10, cenário 1 — "É um match!" com as fotos dos dois */
export default function Match() {
  const lastMatch = useDiscovery((s) => s.lastMatch);
  const setMatch = useDiscovery((s) => s.setMatch);
  const { user, profile } = useSession();

  const fechar = () => {
    setMatch(null);
    router.back();
  };

  if (!lastMatch) {
    return null;
  }
  const { pessoa, conexaoId } = lastMatch;
  const minhaFoto = profile?.fotos[0]?.uri;
  const fotoDela = pessoa.fotos[0];

  return (
    <View style={styles.backdrop}>
      <LinearGradient
        colors={[colors.brand.green + '55', 'rgba(11,11,11,0.96)', colors.bg.base]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.content}>
        <Text variant="overline" color={colors.brand.green}>
          Nova conexão de treino
        </Text>
        <Text variant="displayXL" style={{ textAlign: 'center' }}>
          É um match!
        </Text>
        <Text variant="bodyLarge" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          Você e {pessoa.nome.split(' ')[0]} curtiram um ao outro. Combinem o próximo treino.
        </Text>

        <View style={styles.photos}>
          <View style={[styles.photo, { transform: [{ rotate: '-8deg' }] }]}>
            {minhaFoto ? (
              <Image source={{ uri: minhaFoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Avatar nome={user?.nome || 'Você'} />
            )}
          </View>
          <View style={[styles.photo, { transform: [{ rotate: '8deg' }], marginLeft: -28 }]}>
            {fotoDela ? (
              <Image source={{ uri: fotoDela }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Avatar nome={pessoa.nome} />
            )}
          </View>
        </View>

        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button
            title="Enviar mensagem"
            variant="success"
            onPress={() => {
              setMatch(null);
              router.replace({ pathname: '/chat/[id]', params: { id: conexaoId ?? pessoa.id } });
            }}
          />
          <Button title="Continuar descobrindo" variant="ghost" onPress={fechar} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,11,11,0.92)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  photos: { flexDirection: 'row', marginVertical: spacing.xl },
  photo: {
    width: 140,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.bg.base,
    backgroundColor: colors.bg.elevated,
  },
});
