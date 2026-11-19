import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { RadioRow, SettingsGroup, ToggleRow } from '@/components/settings-rows';
import { Header, Screen, Text } from '@/components/ui';
import { toast } from '@/components/ui/toast';
import { PrivacySettings } from '@/domain/engagement';
import { VISIBILITIES } from '@/domain/feed';
import { ENGAGEMENT_MESSAGES, engagementApi } from '@/features/engagement/api';
import { usePublish } from '@/store/publish';
import { colors } from '@/theme';

/**
 * C1 (Privacidade) · US-23 — RN-008 e RN-021
 * • Mostrar distância aproximada no card da descoberta (nunca a localização exata).
 * • Visibilidade padrão das publicações novas (dá para trocar em cada publicação).
 * • Aparecer na descoberta (pausar o perfil sem excluir a conta).
 * Tudo é aplicado no banco (buscar_parceiros e salvar_privacidade, migration 0013).
 */
export default function Privacidade() {
  const [p, setP] = useState<PrivacySettings | null>(null);
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    engagementApi
      .privacy()
      .then(setP)
      .catch(() => toast(ENGAGEMENT_MESSAGES.generic, 'error'));
  }, []);

  const save = (patch: Partial<PrivacySettings>, okMessage?: string) => {
    if (!p) return;
    const before = p;
    const next = { ...p, ...patch };
    setP(next);
    // a próxima publicação já nasce com a visibilidade escolhida
    if (patch.visibilidadePadrao) usePublish.getState().update({ visibilidade: patch.visibilidadePadrao });
    saving.current = saving.current.then(() =>
      engagementApi.savePrivacy(next).then(
        () => {
          if (okMessage) toast(okMessage);
        },
        () => {
          setP(before);
          toast(ENGAGEMENT_MESSAGES.generic, 'error');
        },
      ),
    );
  };

  return (
    <Screen scroll>
      <Header title="Privacidade" />
      {p === null ? (
        <ActivityIndicator color={colors.brand.red} />
      ) : (
        <>
          <SettingsGroup title="Descoberta">
            <ToggleRow
              first
              icon="eye-outline"
              label="Aparecer na descoberta"
              hint="Desligado, seu perfil fica pausado: ninguém novo te encontra, mas suas conexões continuam."
              value={p.visivelDescoberta}
              onChange={(v) =>
                save({ visivelDescoberta: v }, v ? 'Seu perfil voltou para a descoberta.' : 'Perfil pausado.')
              }
            />
            <ToggleRow
              icon="navigate-outline"
              label="Mostrar distância aproximada"
              hint="Aparece arredondada em km. Sua localização exata nunca é mostrada."
              value={p.mostrarDistancia}
              onChange={(v) => save({ mostrarDistancia: v })}
            />
          </SettingsGroup>

          <SettingsGroup title="Quem vê minhas publicações (padrão)">
            {VISIBILITIES.map((v, i) => (
              <RadioRow
                key={v.value}
                first={i === 0}
                label={v.label}
                hint={v.hint}
                selected={p.visibilidadePadrao === v.value}
                onPress={() => save({ visibilidadePadrao: v.value })}
              />
            ))}
          </SettingsGroup>
          <Text variant="caption" color={colors.text.muted}>
            Vale para as próximas publicações. Você ainda pode mudar em cada uma antes de publicar. Pessoas
            bloqueadas nunca veem suas publicações.
          </Text>
        </>
      )}
    </Screen>
  );
}
