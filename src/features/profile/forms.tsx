import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn } from 'react-native-reanimated';

import { ActionSheet, Button, Chip, Sheet, SheetAction, Text } from '@/components/ui';
import { DIAS, GENEROS, INTERESSES, MODALIDADES, NIVEIS, OBJETIVOS, PERIODOS } from '@/constants/catalogos';
import { makeMain, MAX_PHOTOS_MESSAGE, movePhoto, ProfileData, sameSlot, toggle } from '@/domain/profile';
import { PROFILE_LIMITS } from '@/domain/rules';
import { colors, radius, spacing, typography } from '@/theme';

import { compressPhoto } from './api';

const GRID_GAP = spacing.sm + 2;

type Props = { value: ProfileData; onChange: (patch: Partial<ProfileData>) => void };

/* ---------- Etapa 1: fotos, bio e gênero ---------- */

export function PhotosBioGender({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<
    | { kind: 'source' }
    | { kind: 'photo'; index: number }
    | { kind: 'notice'; title: string; message: string }
    | null
  >(null);
  const [gridWidth, setGridWidth] = useState(0);
  const full = value.fotos.length >= PROFILE_LIMITS.photos.max;
  const close = () => setSheet(null);

  // 3 colunas exatas: (largura - 2 espaços) / 3. Evita a grade "quebrar" em 2 colunas.
  const slotWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * 2) / 3) : 0;

  const add = async (source: 'galeria' | 'camera') => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setSheet({
        kind: 'notice',
        title: 'Permissão necessária',
        message: `Permita o acesso à ${source === 'camera' ? 'câmera' : 'galeria'} nas configurações do aparelho para adicionar fotos.`,
      });
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

  const openSource = () =>
    setSheet(
      full ? { kind: 'notice', title: 'Limite de fotos', message: MAX_PHOTOS_MESSAGE } : { kind: 'source' },
    );

  const photoActions = (i: number): SheetAction[] => [
    ...(i > 0
      ? [
          {
            label: 'Definir como principal',
            icon: 'star-outline' as const,
            onPress: () => onChange({ fotos: makeMain(value.fotos, i) }),
          },
          {
            label: 'Mover para a esquerda',
            icon: 'arrow-back' as const,
            onPress: () => onChange({ fotos: movePhoto(value.fotos, i, -1) }),
          },
        ]
      : []),
    ...(i < value.fotos.length - 1
      ? [
          {
            label: 'Mover para a direita',
            icon: 'arrow-forward' as const,
            onPress: () => onChange({ fotos: movePhoto(value.fotos, i, 1) }),
          },
        ]
      : []),
    {
      label: 'Remover foto',
      icon: 'trash-outline' as const,
      destructive: true,
      onPress: () => onChange({ fotos: value.fotos.filter((_, j) => j !== i) }),
    },
  ];

  const bioLen = value.bio.length;
  const bioOver = bioLen > PROFILE_LIMITS.bioMax;
  const selectedPhoto = sheet?.kind === 'photo' ? value.fotos[sheet.index] : undefined;

  return (
    <View style={{ gap: spacing.xl - 4 }}>
      <Section
        title="Fotos"
        subtitle={`${value.fotos.length} de ${PROFILE_LIMITS.photos.max} · a primeira é a principal. Toque numa foto para reordenar.`}>
        <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {slotWidth > 0 &&
            Array.from({ length: PROFILE_LIMITS.photos.max }, (_, i) => {
              const f = value.fotos[i];
              const size = { width: slotWidth, height: Math.round(slotWidth * 1.25) };
              if (f) {
                return (
                  <Animated.View key={f.uri} entering={ZoomIn.duration(220)} layout={LinearTransition}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        i === 0 ? 'Foto principal, abrir opções' : `Foto ${i + 1}, abrir opções`
                      }
                      onPress={() => setSheet({ kind: 'photo', index: i })}
                      style={({ pressed }) => [styles.slot, size, pressed && { opacity: 0.85 }]}>
                      <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {i === 0 ? (
                        <View style={styles.mainTag}>
                          <Ionicons name="star" size={10} color={colors.white} />
                          <Text variant="overline" color={colors.white}>
                            Principal
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.moreBtn}>
                        <Ionicons name="ellipsis-horizontal" size={14} color={colors.white} />
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              }
              const isNext = i === value.fotos.length;
              return (
                <Pressable
                  key={`vazio-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar foto"
                  disabled={!isNext || busy}
                  onPress={openSource}
                  style={({ pressed }) => [
                    styles.slot,
                    styles.empty,
                    size,
                    isNext && styles.emptyNext,
                    pressed && { opacity: 0.7 },
                  ]}>
                  {isNext ? (
                    busy ? (
                      <ActivityIndicator color={colors.brand.red} />
                    ) : (
                      <View style={styles.addCircle}>
                        <Ionicons name="add" size={22} color={colors.white} />
                      </View>
                    )
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.border.strong} />
                  )}
                </Pressable>
              );
            })}
        </View>
      </Section>

      <Section title="Bio" subtitle="Conte um pouco sobre você e seu treino.">
        <TextInput
          accessibilityLabel="Bio"
          multiline
          value={value.bio}
          onChangeText={(bio) => onChange({ bio })}
          placeholder="Conte como você treina, seus horários e o que procura num parceiro."
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.brand.red}
          style={[styles.bio, bioOver && { borderColor: colors.brand.red }]}
        />
        <Text
          variant="caption"
          color={bioOver ? colors.brand.red : colors.text.muted}
          style={{ textAlign: 'right', marginTop: -spacing.xs }}>
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

      <ActionSheet
        visible={sheet?.kind === 'source'}
        onClose={close}
        title="Adicionar foto"
        message="Use fotos recentes em que dá para ver seu rosto."
        actions={[
          { label: 'Escolher da galeria', icon: 'images-outline', onPress: () => add('galeria') },
          { label: 'Tirar foto agora', icon: 'camera-outline', onPress: () => add('camera') },
        ]}
      />

      <ActionSheet
        visible={sheet?.kind === 'photo'}
        onClose={close}
        header={
          selectedPhoto ? (
            <View style={styles.preview}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.previewImg} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3">
                  {sheet?.kind === 'photo' && sheet.index === 0
                    ? 'Foto principal'
                    : `Foto ${(sheet?.kind === 'photo' ? sheet.index : 0) + 1}`}
                </Text>
                <Text variant="caption" color={colors.text.muted}>
                  É a primeira foto que as pessoas veem na descoberta.
                </Text>
              </View>
            </View>
          ) : null
        }
        actions={sheet?.kind === 'photo' ? photoActions(sheet.index) : []}
      />

      <Sheet
        visible={sheet?.kind === 'notice'}
        onClose={close}
        icon="alert-circle-outline"
        tone="danger"
        title={sheet?.kind === 'notice' ? sheet.title : undefined}
        message={sheet?.kind === 'notice' ? sheet.message : undefined}>
        <Button title="Entendi" onPress={close} />
      </Sheet>
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
    <View style={{ gap: spacing.sm + 4 }}>
      <View style={{ gap: 2 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.text.muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  slot: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  emptyNext: { borderColor: colors.brand.red, backgroundColor: '#1E1312' },
  addCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand.red,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  moreBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewImg: { width: 64, height: 80, borderRadius: radius.sm },
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
