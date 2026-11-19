import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, Header, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { GENEROS } from '@/constants/catalogos';
import { toggle } from '@/domain/profile';
import { SEARCH_RADIUS_KM } from '@/domain/rules';
import { defaultPreferences, PROFILE_MESSAGES, Preferences, profileApi } from '@/features/profile/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** P11 · US-05, cenário 2 — Preferências de descoberta (aplicadas na busca de perfis, US-08) */
export default function PreferenciasDescoberta() {
  const user = useSession((s) => s.user);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user)
      profileApi
        .loadPreferences(user.id)
        .then(setPrefs)
        .catch(() => setPrefs(defaultPreferences));
  }, [user]);

  if (!prefs) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand.red} />
      </Screen>
    );
  }

  const set = (patch: Partial<Preferences>) => setPrefs({ ...prefs, ...patch });

  const salvar = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await profileApi.savePreferences(user.id, prefs);
      toast(PROFILE_MESSAGES.prefsSaved);
      router.back();
    } catch {
      toast(PROFILE_MESSAGES.generic, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll footer={<Button title="Salvar preferências" onPress={salvar} loading={saving} />}>
      <Header title="Preferências" />
      <Text variant="body" color={colors.text.secondary}>
        Defina quem você quer encontrar. Vale a partir da próxima busca de perfis.
      </Text>

      <Card>
        <Text variant="h3">Faixa etária</Text>
        <View style={styles.ages}>
          <Stepper
            label="De"
            value={prefs.idadeMin}
            min={18}
            max={prefs.idadeMax}
            onChange={(idadeMin) => set({ idadeMin })}
          />
          <Stepper
            label="Até"
            value={prefs.idadeMax}
            min={prefs.idadeMin}
            max={99}
            onChange={(idadeMax) => set({ idadeMax })}
          />
        </View>
      </Card>

      <Card>
        <Text variant="h3">Gênero de interesse para parceria</Text>
        <Text variant="caption" color={colors.text.muted}>
          Nenhum selecionado = todos.
        </Text>
        <View style={styles.chips}>
          {GENEROS.filter((g) => g !== 'Prefiro não dizer').map((g) => (
            <Chip
              key={g}
              label={g}
              selected={prefs.generos.includes(g)}
              onPress={() => set({ generos: toggle(prefs.generos, g) })}
            />
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.between}>
          <Text variant="h3">Distância máxima</Text>
          <Text variant="labelSmall" color={colors.brand.red}>
            {prefs.distanciaKm} km
          </Text>
        </View>
        <Slider
          accessibilityLabel="Distância máxima em quilômetros"
          minimumValue={SEARCH_RADIUS_KM.min}
          maximumValue={SEARCH_RADIUS_KM.max}
          step={1}
          value={prefs.distanciaKm}
          onValueChange={(v) => set({ distanciaKm: Math.round(v) })}
          minimumTrackTintColor={colors.brand.red}
          maximumTrackTintColor={colors.border.strong}
          thumbTintColor={colors.brand.red}
        />
        <View style={styles.between}>
          <Text variant="caption" color={colors.text.muted}>
            1 km
          </Text>
          <Text variant="caption" color={colors.text.muted}>
            50 km
          </Text>
        </View>
      </Card>

      <Card>
        <Toggle
          label="Somente minha academia"
          hint="Mostrar só quem treina na sua academia principal ou secundárias."
          value={prefs.somenteMinhaAcademia}
          onChange={(somenteMinhaAcademia) => set({ somenteMinhaAcademia })}
        />
        <Toggle
          label="Aparecer na descoberta"
          hint="Desligue para pausar seu perfil sem excluir a conta."
          value={prefs.visivel}
          onChange={(visivel) => set({ visivel })}
        />
      </Card>
    </Screen>
  );
}

function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn = (delta: number, symbol: string) => {
    const next = props.value + delta;
    const disabled = next < props.min || next > props.max;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${props.label}: ${delta > 0 ? 'aumentar' : 'diminuir'}`}
        disabled={disabled}
        onPress={() => props.onChange(next)}
        style={[styles.stepBtn, disabled && { opacity: 0.4 }]}>
        <Text variant="h3">{symbol}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, flex: 1 }}>
      <Text variant="caption" color={colors.text.muted}>
        {props.label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {btn(-1, '−')}
        <Text variant="h2" style={{ minWidth: 36, textAlign: 'center' }}>
          {props.value}
        </Text>
        {btn(1, '+')}
      </View>
    </View>
  );
}

function Toggle(props: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.between, { gap: spacing.md }]}>
      <View style={{ flex: 1 }}>
        <Text variant="labelButton">{props.label}</Text>
        <Text variant="caption" color={colors.text.muted}>
          {props.hint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={props.label}
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ true: colors.brand.green, false: colors.border.strong }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ages: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
