import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/**
 * P4 · US-03, cenários 3 e 4 — Permissão de localização (RN-008).
 * A localização é pedida só aqui, depois do perfil, e usada apenas para buscar academias.
 */
export default function PermissaoLocalizacao() {
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const permitir = async () => {
    setLoading(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        router.push({ pathname: '/academias', params: { modo: 'proximas' } });
      } else {
        setDenied(!canAskAgain || status === 'denied');
      }
    } finally {
      setLoading(false);
    }
  };

  const manual = () => router.push({ pathname: '/academias', params: { modo: 'busca' } });

  return (
    <Screen
      footer={
        <>
          {denied ? (
            <Button title="Ativar localização" onPress={() => Linking.openSettings()} />
          ) : (
            <Button title="Permitir localização" onPress={permitir} loading={loading} />
          )}
          <Button title="Buscar academia manualmente" variant="ghost" onPress={manual} />
        </>
      }>
      <View style={styles.hero}>
        <View style={styles.halo}>
          <View style={styles.pin}>
            <Ionicons name="location-outline" size={30} color={colors.white} />
          </View>
        </View>
      </View>
      <Text variant="h1" style={{ textAlign: 'center' }}>
        Encontre academias perto de você
      </Text>
      <Text variant="bodyLarge" color={colors.text.secondary} style={{ textAlign: 'center' }}>
        Usamos sua localização apenas para encontrar academias próximas e pessoas que treinam nelas.
      </Text>
      <View style={styles.box}>
        <Row
          icon="shield-outline"
          text="Ninguém vê sua localização exata — só sua academia e a distância aproximada."
        />
        <Row icon="eye-outline" text="Você pode ocultar a distância a qualquer momento em Privacidade." />
      </View>
      {denied ? (
        <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
          A localização está desativada. Você pode buscar sua academia pelo nome, cidade ou bairro, ou ativar
          nas configurações do aparelho.
        </Text>
      ) : null}
    </Screen>
  );
}

function Row({ icon, text }: { icon: 'shield-outline' | 'eye-outline'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm + 4 }}>
      <Ionicons name={icon} size={20} color={colors.brand.green} />
      <Text variant="body" color={colors.text.secondary} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginVertical: spacing.lg },
  halo: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#2A1716',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
    gap: spacing.md,
  },
});
