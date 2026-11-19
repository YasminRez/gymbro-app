import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet, Button, Chip, KeyboardTextInput, Notice, Screen, Sheet, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { MODALIDADES } from '@/constants/catalogos';
import {
  CAPTION_MAX,
  canPublish,
  DURATIONS,
  FEED_MESSAGES,
  FeedError,
  formatDuration,
  VISIBILITIES,
} from '@/domain/feed';
import { feedApi } from '@/features/feed/api';
import { usePublish } from '@/store/publish';
import { useSession } from '@/store/session';
import { colors, radius, spacing, typography } from '@/theme';

/**
 * F4 · US-15 — Nova publicação
 * Foto (câmera ou galeria), legenda até 300, modalidade, duração e visibilidade (RN-021).
 * A primeira publicação do dia vira check-in (RN-017, decidido no banco).
 * Falhou o envio? O rascunho fica salvo e dá para tentar de novo sem duplicar.
 */
export default function Publicar() {
  const { draft, update, reset, setResult, bumpFeed } = usePublish();
  const profile = useSession((s) => s.profile);
  const [source, setSource] = useState(false);
  const [permissao, setPermissao] = useState<'camera' | 'galeria' | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outra, setOutra] = useState(
    draft.duracaoMin !== null && !(DURATIONS as readonly number[]).includes(draft.duracaoMin),
  );

  // Modalidades do perfil primeiro
  const modalidades = useMemo(() => {
    const minhas = profile?.modalidades ?? [];
    return [...minhas, ...MODALIDADES.filter((m) => !minhas.includes(m))];
  }, [profile]);

  const escolher = async (de: 'camera' | 'galeria') => {
    const perm =
      de === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissao(de);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
      aspect: [4, 5],
    };
    const r =
      de === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled) {
      update({ fotoUri: r.assets[0].uri });
      setError(null);
    }
  };

  const publicar = async () => {
    if (!canPublish(draft) || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await feedApi.publish(draft);
      setResult(r);
      reset();
      setOutra(false);
      bumpFeed();
      router.navigate('/feed');
      if (r.checkin) router.push('/dia-concluido');
      else toast('Publicado no feed. Hoje você já tinha feito check-in.');
    } catch (e) {
      // US-15, cenário 5: rascunho continua salvo (store persistida)
      setError(e instanceof FeedError ? e.message : FEED_MESSAGES.publishFailed);
    } finally {
      setSending(false);
    }
  };

  const ok = canPublish(draft);
  const legendaLen = draft.legenda.length;

  return (
    <Screen
      scroll
      footer={
        <>
          {!draft.fotoUri ? (
            <View style={styles.hint}>
              <Ionicons name="image-outline" size={16} color={colors.text.muted} />
              <Text variant="caption" color={colors.text.muted}>
                {FEED_MESSAGES.noPhoto}
              </Text>
            </View>
          ) : null}
          <Button
            title={error ? 'Tentar novamente' : 'Publicar'}
            onPress={publicar}
            disabled={!ok}
            loading={sending}
          />
        </>
      }>
      <View style={styles.top}>
        <Text variant="h1">Novo treino</Text>
        {draft.fotoUri || draft.legenda ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              reset();
              setOutra(false);
              setError(null);
            }}
            hitSlop={8}>
            <Text variant="labelSmall" color={colors.text.muted}>
              Descartar
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text variant="body" color={colors.text.secondary} style={{ marginTop: -spacing.sm }}>
        A primeira foto do dia conta como check-in e soma na sua sequência.
      </Text>

      {error ? (
        <Notice tone="error" icon="cloud-offline-outline">
          {error}
        </Notice>
      ) : null}

      {/* Foto */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={draft.fotoUri ? 'Trocar foto' : 'Adicionar foto do treino'}
        onPress={() => setSource(true)}
        style={({ pressed }) => [
          styles.photo,
          !draft.fotoUri && styles.photoEmpty,
          pressed && { opacity: 0.85 },
        ]}>
        {draft.fotoUri ? (
          <>
            <Image source={{ uri: draft.fotoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.change}>
              <Ionicons name="camera-reverse-outline" size={16} color={colors.white} />
              <Text variant="labelSmall" color={colors.white}>
                Trocar
              </Text>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <View style={styles.camCircle}>
              <Ionicons name="camera" size={30} color={colors.white} />
            </View>
            <Text variant="labelButton">Adicionar foto</Text>
            <Text variant="caption" color={colors.text.muted}>
              Tire agora ou escolha da galeria
            </Text>
          </View>
        )}
      </Pressable>

      {/* Legenda */}
      <Field title="Legenda" optional>
        <KeyboardTextInput
          accessibilityLabel="Legenda"
          multiline
          maxLength={CAPTION_MAX}
          value={draft.legenda}
          onChangeText={(legenda) => update({ legenda })}
          placeholder="Como foi o treino?"
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.brand.red}
          style={styles.input}
        />
        <Text
          variant="caption"
          color={legendaLen >= CAPTION_MAX ? colors.brand.red : colors.text.muted}
          style={{ textAlign: 'right', marginTop: -spacing.xs }}>
          {legendaLen}/{CAPTION_MAX}
        </Text>
      </Field>

      {/* Modalidade */}
      <Field title="Modalidade">
        <View style={styles.chips}>
          {modalidades.map((m) => (
            <Chip
              key={m}
              label={m}
              selected={draft.modalidade === m}
              onPress={() => update({ modalidade: draft.modalidade === m ? null : m })}
            />
          ))}
        </View>
      </Field>

      {/* Duração */}
      <Field title="Duração">
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip
              key={d}
              label={formatDuration(d)!}
              selected={!outra && draft.duracaoMin === d}
              onPress={() => {
                setOutra(false);
                update({ duracaoMin: draft.duracaoMin === d && !outra ? null : d });
              }}
            />
          ))}
          <Chip
            label="Outra"
            selected={outra}
            onPress={() => {
              setOutra(!outra);
              update({ duracaoMin: null });
            }}
          />
        </View>
        {outra ? (
          <View style={styles.minutes}>
            <KeyboardTextInput
              accessibilityLabel="Duração em minutos"
              keyboardType="number-pad"
              maxLength={3}
              value={draft.duracaoMin ? String(draft.duracaoMin) : ''}
              onChangeText={(t) => update({ duracaoMin: t ? Number(t.replace(/\D/g, '')) || null : null })}
              placeholder="0"
              placeholderTextColor={colors.text.muted}
              selectionColor={colors.brand.red}
              style={styles.minutesInput}
            />
            <Text variant="body" color={colors.text.secondary}>
              minutos (até 600)
            </Text>
          </View>
        ) : null}
      </Field>

      {/* Visibilidade (RN-021) */}
      <Field title="Quem pode ver">
        <View style={{ gap: spacing.sm }}>
          {VISIBILITIES.map((v) => {
            const on = draft.visibilidade === v.value;
            return (
              <Pressable
                key={v.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => update({ visibilidade: v.value })}
                style={[styles.radio, on && { borderColor: colors.brand.red, backgroundColor: '#1E1312' }]}>
                <Ionicons
                  name={v.value === 'conexoes' ? 'people-outline' : 'barbell-outline'}
                  size={20}
                  color={on ? colors.brand.red : colors.text.secondary}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="labelButton">{v.label}</Text>
                  <Text variant="caption" color={colors.text.muted}>
                    {v.hint}
                  </Text>
                </View>
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={on ? colors.brand.red : colors.border.strong}
                />
              </Pressable>
            );
          })}
        </View>
      </Field>

      <ActionSheet
        visible={source}
        onClose={() => setSource(false)}
        title="Foto do treino"
        actions={[
          { label: 'Tirar foto agora', icon: 'camera-outline', onPress: () => escolher('camera') },
          { label: 'Escolher da galeria', icon: 'images-outline', onPress: () => escolher('galeria') },
        ]}
      />
      <Sheet
        visible={!!permissao}
        onClose={() => setPermissao(null)}
        icon="lock-closed-outline"
        tone="danger"
        title="Permissão necessária"
        message={`Permita o acesso à ${permissao === 'camera' ? 'câmera' : 'galeria'} nas configurações do aparelho.`}>
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Abrir configurações"
            onPress={() => {
              setPermissao(null);
              Linking.openSettings();
            }}
          />
          <Button title="Agora não" variant="ghost" onPress={() => setPermissao(null)} />
        </View>
      </Sheet>
    </Screen>
  );
}

function Field({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm + 2, marginTop: spacing.xs }}>
      <Text variant="h3">
        {title}
        {optional ? (
          <Text variant="caption" color={colors.text.muted}>
            {'  '}opcional
          </Text>
        ) : null}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brand.red,
    backgroundColor: '#1E1312',
  },
  camCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  change: {
    position: 'absolute',
    right: spacing.sm + 4,
    bottom: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  input: {
    minHeight: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    color: colors.text.primary,
    padding: spacing.md,
    textAlignVertical: 'top',
    ...typography.bodyLarge,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  minutes: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  minutesInput: {
    width: 80,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    color: colors.text.primary,
    textAlign: 'center',
    ...typography.h3,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
});
