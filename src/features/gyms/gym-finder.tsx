import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputInstance,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Button, Card, Chip, Notice, Text } from '@/components/ui';
import { formatDistance, Gym, GYM_MESSAGES } from '@/domain/gyms';
import { SEARCH_RADIUS_KM } from '@/domain/rules';
import { profileApi } from '@/features/profile/api';
import { searchGymsByText, searchNearbyGyms } from '@/lib/gym-search';
import { getCurrentCoords, turnOnLocationServices } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * P5/P6/P7 · US-06 — Academias próximas em lista e mapa, busca por texto e
 * estado "nenhuma academia encontrada". A ação do cartão vem de fora
 * ("Treino aqui" no onboarding, "Também treino aqui" em Minha academia).
 */
export type GymAction = { label: string; onPress: (gym: Gym) => void; variant?: 'primary' | 'secondary' };

const RAIOS = [5, 10, 25, SEARCH_RADIUS_KM.max];

export function GymFinder({
  actions,
  hidePlaceIds = [],
  startWithSearch = false,
}: {
  actions: (gym: Gym) => GymAction[];
  hidePlaceIds?: string[];
  startWithSearch?: boolean;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<'locating' | 'ok' | 'denied' | 'services-off' | 'unavailable'>(
    'locating',
  );
  const [raio, setRaio] = useState<number>(SEARCH_RADIUS_KM.default);
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'lista' | 'mapa'>('lista');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Gym | null>(null);
  const searchRef = useRef<TextInputInstance>(null);

  const withCounts = useCallback(async (list: Gym[]) => {
    // Contagem do GymBrô é um extra: se o banco demorar, mostra as academias sem ela
    const counts = await Promise.race([
      profileApi.countUsers(list.map((g) => g.placeId)).catch(() => ({}) as Record<string, number>),
      new Promise<Record<string, number>>((r) => setTimeout(() => r({}), 3_000)),
    ]);
    return list.map((g) => ({ ...g, usuarios: counts[g.placeId] ?? 0 }));
  }, []);

  /** Busca por texto (se houver) ou por proximidade, com os parâmetros informados */
  const buscar = useCallback(
    async (opts: { texto: string; coords: { lat: number; lng: number } | null; raio: number }) => {
      setLoading(true);
      setError(false);
      setSelected(null);
      try {
        let list: Gym[] = [];
        if (opts.texto.trim().length >= 2)
          list = await searchGymsByText(opts.texto, opts.coords ?? undefined);
        else if (opts.coords) list = await searchNearbyGyms(opts.coords.lat, opts.coords.lng, opts.raio);
        setGyms(await withCounts(list));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [withCounts],
  );

  // Localização só no momento da busca, nunca guardada (RN-008)
  const localizar = useCallback(
    async (ask: boolean) => {
      const r = await getCurrentCoords({ ask }).catch(() => ({ status: 'unavailable' as const }));
      if (r.status !== 'ok') {
        setLocState(r.status);
        searchRef.current?.focus();
        return;
      }
      setLocState('ok');
      setCoords(r.coords);
      if (startWithSearch) searchRef.current?.focus();
      else buscar({ texto: '', coords: r.coords, raio: SEARCH_RADIUS_KM.default });
    },
    [buscar, startWithSearch],
  );

  const tentarDeNovo = useCallback(
    (ask: boolean) => {
      setLocState('locating');
      localizar(ask);
    },
    [localizar],
  );

  // Primeira busca ao abrir a tela (fora do corpo do efeito, como callback)
  useEffect(() => {
    const t = setTimeout(() => localizar(!startWithSearch), 0);
    return () => clearTimeout(t);
  }, [localizar, startWithSearch]);

  // Voltou das configurações (ligou o GPS ou deu a permissão)? Tenta de novo sozinho.
  const locStateRef = useRef(locState);
  useEffect(() => {
    locStateRef.current = locState;
  }, [locState]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const s = locStateRef.current;
      if (st === 'active' && (s === 'denied' || s === 'services-off' || s === 'unavailable'))
        tentarDeNovo(false);
    });
    return () => sub.remove();
  }, [tentarDeNovo]);

  const mudarRaio = (r: number) => {
    setRaio(r);
    setTexto('');
    buscar({ texto: '', coords, raio: r });
  };

  const visible = useMemo(() => gyms.filter((g) => !hidePlaceIds.includes(g.placeId)), [gyms, hidePlaceIds]);
  const searchedText = texto.trim().length >= 2;
  const showEmpty = !loading && !error && (coords || searchedText) && visible.length === 0;
  const nextRaio = RAIOS.find((r) => r > raio);

  return (
    <View style={{ gap: spacing.md, flex: 1 }}>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.text.muted} />
        <TextInput
          ref={searchRef}
          accessibilityLabel="Buscar academia por nome, bairro ou cidade"
          placeholder="Nome, bairro ou cidade"
          placeholderTextColor={colors.text.muted}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => buscar({ texto, coords, raio })}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {texto ? (
          <Pressable
            accessibilityLabel="Limpar busca"
            hitSlop={10}
            onPress={() => {
              setTexto('');
              if (coords) buscar({ texto: '', coords, raio });
            }}>
            <Ionicons name="close-circle" size={20} color={colors.text.muted} />
          </Pressable>
        ) : null}
      </View>

      {locState === 'locating' ? (
        <View style={styles.locating}>
          <ActivityIndicator color={colors.brand.red} />
          <Text variant="body" color={colors.text.secondary}>
            Procurando sua localização…
          </Text>
        </View>
      ) : locState !== 'ok' ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'flex-start' }}>
            <Ionicons name="location-outline" size={22} color={colors.brand.red} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelButton">
                {locState === 'services-off'
                  ? 'A localização do celular está desligada'
                  : locState === 'denied'
                    ? 'Sem permissão de localização'
                    : 'Não conseguimos achar sua posição'}
              </Text>
              <Text variant="body" color={colors.text.secondary}>
                {locState === 'unavailable'
                  ? 'Vá para um lugar aberto ou tente de novo. Você também pode pesquisar pelo nome, bairro ou cidade.'
                  : 'Enquanto isso, pesquise pelo nome, bairro ou cidade.'}
              </Text>
            </View>
          </View>
          {locState === 'services-off' ? (
            <Button title="Ligar localização" variant="secondary" onPress={turnOnLocationServices} />
          ) : locState === 'denied' ? (
            <Button title="Permitir localização" variant="secondary" onPress={() => tentarDeNovo(true)} />
          ) : (
            <Button title="Tentar de novo" variant="secondary" onPress={() => tentarDeNovo(false)} />
          )}
          {locState === 'denied' ? (
            <Pressable
              onPress={() => Linking.openSettings()}
              style={{ alignSelf: 'center', padding: spacing.xs }}>
              <Text variant="labelSmall" color={colors.text.muted}>
                Abrir configurações do aparelho
              </Text>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <View style={styles.toolbar}>
          <View style={styles.chips}>
            {RAIOS.map((r) => (
              <Chip
                key={r}
                label={`${r} km`}
                selected={raio === r && !searchedText}
                onPress={() => mudarRaio(r)}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setModo(modo === 'lista' ? 'mapa' : 'lista')}
            style={styles.toggle}>
            <Ionicons
              name={modo === 'lista' ? 'map-outline' : 'list-outline'}
              size={18}
              color={colors.brand.red}
            />
            <Text variant="labelSmall" color={colors.brand.red}>
              {modo === 'lista' ? 'Ver no mapa' : 'Ver lista'}
            </Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.locating}>
          <ActivityIndicator color={colors.brand.red} />
          <Text variant="body" color={colors.text.secondary}>
            Buscando academias…
          </Text>
        </View>
      ) : null}
      {error ? (
        <Notice tone="error" icon="cloud-offline-outline">
          Não foi possível buscar academias agora. Verifique sua internet e tente de novo.
        </Notice>
      ) : null}

      {showEmpty ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Ionicons name="barbell-outline" size={36} color={colors.text.muted} />
          <Text variant="h3">
            {searchedText ? 'Nenhuma academia com esse nome.' : GYM_MESSAGES.noneNearby}
          </Text>
          {!searchedText && nextRaio ? (
            <Button
              title={`Aumentar o raio para ${nextRaio} km`}
              variant="secondary"
              onPress={() => mudarRaio(nextRaio)}
            />
          ) : null}
          <Button title="Sugerir academia" onPress={() => router.push('/sugerir-academia')} />
        </Card>
      ) : null}

      {!loading && modo === 'mapa' && coords ? (
        <View style={styles.mapBox}>
          <MapView
            style={StyleSheet.absoluteFill}
            userInterfaceStyle="dark"
            showsUserLocation
            initialRegion={{
              latitude: coords.lat,
              longitude: coords.lng,
              latitudeDelta: (raio / 111) * 2.2,
              longitudeDelta: (raio / 111) * 2.2,
            }}>
            {visible.map((g) => (
              <Marker
                key={g.placeId}
                coordinate={{ latitude: g.lat, longitude: g.lng }}
                pinColor={colors.brand.red}
                onPress={() => setSelected(g)}
              />
            ))}
          </MapView>
        </View>
      ) : null}

      {modo === 'mapa' && selected ? <GymCard gym={selected} actions={actions(selected)} /> : null}

      {modo === 'lista' || !coords
        ? visible.map((g) => <GymCard key={g.placeId} gym={g} actions={actions(g)} />)
        : null}

      {visible.length > 0 ? (
        <Pressable
          onPress={() => router.push('/sugerir-academia')}
          style={{ alignSelf: 'center', padding: spacing.sm }}>
          <Text variant="labelSmall" color={colors.text.secondary}>
            Não achou sua academia?{' '}
            <Text variant="labelSmall" color={colors.brand.red}>
              Sugerir academia
            </Text>
          </Text>
        </Pressable>
      ) : null}

      <Text variant="caption" color={colors.text.muted} style={{ textAlign: 'center' }}>
        Dados de academias © colaboradores do OpenStreetMap
      </Text>
    </View>
  );
}

export function GymCard({ gym, actions }: { gym: Gym; actions: GymAction[] }) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'flex-start' }}>
        <View style={styles.gymIcon}>
          <Ionicons name="barbell" size={22} color={colors.brand.red} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3">{gym.nome}</Text>
          <Text variant="caption" color={colors.text.secondary} numberOfLines={2}>
            {gym.endereco}
          </Text>
          <Text variant="caption" color={colors.text.muted}>
            {[
              gym.distanciaKm !== undefined ? formatDistance(gym.distanciaKm) : null,
              gym.usuarios !== undefined
                ? `${gym.usuarios} ${gym.usuarios === 1 ? 'pessoa' : 'pessoas'} no GymBrô`
                : null,
              gym.status === 'pendente' ? 'Em análise' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
      {actions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          {actions.map((a) => (
            <View key={a.label} style={{ flex: 1 }}>
              <Button title={a.label} variant={a.variant ?? 'primary'} onPress={() => a.onPress(gym)} />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, height: '100%', color: colors.text.primary, ...typography.bodyLarge },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.xs },
  locating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  mapBox: {
    height: 340,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  gymIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#2A1716',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
