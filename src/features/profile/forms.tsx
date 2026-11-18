import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip, Text } from '@/components/ui';
import { DIAS, GENEROS, INTERESSES, MODALIDADES, NIVEIS, OBJETIVOS, PERIODOS } from '@/constants/catalogos';
import { makeMain, MAX_PHOTOS_MESSAGE, movePhoto, ProfileData, sameSlot, toggle } from '@/domain/profile';
import { PROFILE_LIMITS } from '@/domain/rules';
import { colors, radius, spacing, typography } from '@/theme';

import { compressPhoto } from './api';

type Props = { value: ProfileData; onChange: (patch: Partial<ProfileData>) => void };

/* ---------- Etapa 1: fotos, bio e gênero ---------- */

export function PhotosBioGender({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const full = value.fotos.length >= PROFILE_LIMITS.photos.max;

  const add = async (source: 'galeria' | 'camera') => {
    if (full) {
      Alert.alert('Limite de fotos', MAX_PHOTOS_MESSAGE);
      return;
    }
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permissão necessária',
        'Permita o acesso nas configurações do aparelho para adicionar fotos.',
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: source === 'camera',
      aspect: [4, 5],
      allowsMultipleSelection: source === 'galeria',
      selectionLimit: PROFILE_LIMITS.photos.max - value.fotos.length,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(result.assets.map((a) => compressPhoto(a.uri)));
      const novas = compressed.map((uri) => ({ uri, local: true }));
      onChange({ fotos: [...value.fotos, ...novas].slice(0, PROFILE_LIMITS.photos.max) });
    } finally {
      setBusy(false);
    }
  };

  const chooseSource = () => {
    if (full) {
      Alert.alert('Limite de fotos', MAX_PHOTOS_MESSAGE);
      return;
    }
    Alert.alert('Adicionar foto', undefined, [
      { text: 'Galeria', onPress: () => add('galeria') },
      { text: 'Câmera', onPress: () => add('camera') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const photoMenu = (i: number) => {
    const actions = [
      ...(i > 0
        ? [{ label: 'Definir como principal', run: () => onChange({ fotos: makeMain(value.fotos, i) }) }]
        : []),
      ...(i > 0
        ? [{ label: 'Mover para a esquerda', run: () => onChange({ fotos: movePhoto(value.fotos, i, -1) }) }]
        : []),
      ...(i < value.fotos.length - 1
        ? [{ label: 'Mover para a direita', run: () => onChange({ fotos: movePhoto(value.fotos, i, 1) }) }]
        : []),
      {
        label: 'Remover',
        run: () => onChange({ fotos: value.fotos.filter((_, j) => j !== i) }),
        destructive: true,
      },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancelar'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.length - 1,
        },
        (idx) => actions[idx]?.run(),
      );
    } else {
      Alert.alert('Foto', undefined, [
        ...actions.map((a) => ({
          text: a.label,
          onPress: a.run,
          style: a.destructive ? ('destructive' as const) : undefined,
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  };

  const bioLen = value.bio.length;
  const bioOver = bioLen > PROFILE_LIMITS.bioMax;

  return (
    <View style={{ gap: spacing.lg }}>
      <Section
        title="Fotos"
        subtitle="De 1 a 6. A primeira é a foto principal; toque numa foto para reordenar.">
        <View style={styles.grid}>
          {Array.from({ length: PROFILE_LIMITS.photos.max }, (_, i) => {
            const f = value.fotos[i];
            if (f) {
              return (
                <Pressable
                  key={f.uri}
                  accessibilityRole="button"
                  accessibilityLabel={i === 0 ? 'Foto principal' : `Foto ${i + 1}`}
                  onPress={() => photoMenu(i)}
                  style={styles.slot}>
                  <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {i === 0 ? (
                    <View style={styles.mainTag}>
                      <Text variant="caption" color={colors.white}>
                        Principal
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            }
            const isNext = i === value.fotos.length;
            return (
              <Pressable
                key={`vazio-${i}`}
                accessibilityRole="button"
                accessibilityLabel="Adicionar foto"
                disabled={!isNext || busy}
                onPress={chooseSource}
                style={[styles.slot, styles.empty, isNext && { borderColor: colors.brand.red }]}>
                {isNext ? (
                  <Ionicons name={busy ? 'hourglass-outline' : 'add'} size={28} color={colors.brand.red} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Bio">
        <TextInput
          accessibilityLabel="Bio"
          multiline
          value={value.bio}
          onChangeText={(bio) => onChange({ bio })}
          placeholder="Conte como você treina, seus horários e o que procura num parceiro."
          placeholderTextColor={colors.text.muted}
          style={[styles.bio, bioOver && { borderColor: colors.brand.red }]}
        />
        <Text
          variant="caption"
          color={bioOver ? colors.brand.red : colors.text.muted}
          style={{ textAlign: 'right' }}>
          {bioLen}/{PROFILE_LIMITS.bioMax}
        </Text>
      </Section>

      <Section title="Gênero">
        <Chips
          options={GENEROS}
          selected={value.genero ? [value.genero] : []}
          onToggle={(g) => onChange({ genero: g })}
        />
      </Section>
    </View>
  );
}

/* ---------- Etapa 2: treino ---------- */

export function Training({ value, onChange }: Props) {
  return (
    <View style={{ gap: spacing.lg }}>
      <Section title="Modalidades">
        <Chips
          options={MODALIDADES}
          selected={value.modalidades}
          onToggle={(m) => onChange({ modalidades: toggle(value.modalidades, m) })}
        />
      </Section>
      <Section title="Objetivos">
        <Chips
          options={OBJETIVOS}
          selected={value.objetivos}
          onToggle={(o) => onChange({ objetivos: toggle(value.objetivos, o) })}
        />
      </Section>
      <Section title="Nível">
        <View style={styles.chips}>
          {NIVEIS.map((n) => (
            <Chip
              key={n.value}
              label={n.label}
              selected={value.nivel === n.value}
              onPress={() => onChange({ nivel: n.value })}
            />
          ))}
        </View>
      </Section>
      <Section title="Quando você treina" subtitle="Toque nos períodos de cada dia.">
        <View style={{ gap: spacing.xs }}>
          <View style={styles.row}>
            <View style={styles.dayCol} />
            {PERIODOS.map((p) => (
              <Text key={p.value} variant="caption" color={colors.text.muted} style={styles.cell}>
                {p.label}
              </Text>
            ))}
          </View>
          {DIAS.map((dia, d) => (
            <View key={dia} style={styles.row}>
              <Text variant="labelSmall" color={colors.text.secondary} style={styles.dayCol}>
                {dia}
              </Text>
              {PERIODOS.map((p) => {
                const slot = { dia: d, periodo: p.value };
                const on = value.disponibilidade.some((s) => sameSlot(s, slot));
                return (
                  <Pressable
                    key={p.value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${dia} ${p.label}`}
                    accessibilityState={{ checked: on }}
                    onPress={() =>
                      onChange({ disponibilidade: toggle(value.disponibilidade, slot, undefined, sameSlot) })
                    }
                    style={[
                      styles.cell,
                      styles.slotCell,
                      on && { backgroundColor: colors.brand.red, borderColor: colors.brand.red },
                    ]}>
                    {on ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Section>
    </View>
  );
}

/* ---------- Etapa 3: interesses ---------- */

export function Interests({ value, onChange }: Props) {
  const n = value.interesses.length;
  return (
    <View style={{ gap: spacing.lg }}>
      <Text variant="labelSmall" color={n >= 3 ? colors.brand.green : colors.text.secondary}>
        {n} de 3 a 10 selecionados
      </Text>
      {INTERESSES.map((grupo) => (
        <Section key={grupo.categoria} title={grupo.categoria}>
          <Chips
            options={grupo.nomes}
            selected={value.interesses}
            onToggle={(i) =>
              onChange({ interesses: toggle(value.interesses, i, PROFILE_LIMITS.interests.max) })
            }
          />
        </Section>
      ))}
    </View>
  );
}

/* ---------- Auxiliares ---------- */

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="h3">{title}</Text>
      {subtitle ? (
        <Text variant="caption" color={colors.text.muted}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o} label={o} selected={selected.includes(o)} onPress={() => onToggle(o)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: '31.5%',
    aspectRatio: 4 / 5,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border.strong },
  mainTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: colors.brand.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  bio: {
    minHeight: 110,
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayCol: { width: 40 },
  cell: { flex: 1, textAlign: 'center' },
  slotCell: {
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
