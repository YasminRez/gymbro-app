import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Header, Screen, Text } from '@/components/ui';
import { dayStatuses, monthGrid } from '@/domain/streak';
import { feedApi, MyStats } from '@/features/feed/api';
import { colors, radius, spacing } from '@/theme';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/**
 * US-16, cenário 2 — Calendário de check-ins
 * Dias com check-in mostram a miniatura da foto; dias de descanso (RN-018) têm
 * ícone próprio; dias sem atividade ficam em branco.
 */
export default function Calendario() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState<MyStats | null>(null);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - (spacing.lg - 4) * 2 - 6 * 6) / 7);

  useEffect(() => {
    let alive = true;
    feedApi
      .myStats(`${ym.y}-${String(ym.m).padStart(2, '0')}-01`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [ym]);

  const status = useMemo(() => (data ? dayStatuses(data.datas, data.hoje) : {}), [data]);
  const fotos = useMemo(() => Object.fromEntries((data?.mes ?? []).map((d) => [d.data, d.fotoUrl])), [data]);
  const weeks = monthGrid(ym.y, ym.m);
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
  const ativosNoMes = data?.mes.length ?? 0;
  const descansosNoMes = Object.entries(status).filter(
    ([d, s]) => s === 'descanso' && d.startsWith(`${ym.y}-${String(ym.m).padStart(2, '0')}`),
  ).length;

  const mudar = (delta: number) => {
    setData(null);
    setYm(({ y, m }) => {
      const n = m + delta;
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
    });
  };

  return (
    <Screen scroll>
      <Header title="Calendário" />

      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          hitSlop={12}
          onPress={() => mudar(-1)}>
          <Ionicons name="chevron-back" size={22} color={colors.text.primary} />
        </Pressable>
        <Text variant="h2">
          {MESES[ym.m - 1]} {ym.y}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          hitSlop={12}
          disabled={isCurrent}
          onPress={() => mudar(1)}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrent ? colors.border.strong : colors.text.primary}
          />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text variant="labelSmall" color={colors.brand.green}>
          {ativosNoMes} {ativosNoMes === 1 ? 'dia ativo' : 'dias ativos'}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          · {descansosNoMes} de descanso
        </Text>
        {data ? (
          <Text variant="labelSmall" color={colors.text.muted}>
            · 🔥 {data.sequenciaAtual}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <View style={styles.row}>
          {SEMANA.map((d, i) => (
            <Text
              key={i}
              variant="overline"
              color={colors.text.muted}
              style={{ width: cell, textAlign: 'center' }}>
              {d}
            </Text>
          ))}
        </View>
        {data === null ? (
          <ActivityIndicator color={colors.brand.red} style={{ marginVertical: spacing.xl }} />
        ) : (
          weeks.map((w, i) => (
            <View key={i} style={styles.row}>
              {w.map((d, j) => {
                if (!d) return <View key={j} style={{ width: cell, height: cell * 1.25 }} />;
                const s = status[d];
                const foto = fotos[d];
                const dia = Number(d.slice(8));
                return (
                  <Animated.View
                    key={d}
                    entering={FadeIn.delay((i * 7 + j) * 8)}
                    accessibilityLabel={`${dia}: ${
                      s === 'checkin'
                        ? 'check-in'
                        : s === 'descanso'
                          ? 'dia de descanso'
                          : s === 'hoje'
                            ? 'hoje'
                            : 'sem atividade'
                    }`}
                    style={[
                      styles.cell,
                      { width: cell, height: cell * 1.25 },
                      s === 'descanso' && styles.rest,
                      s === 'hoje' && styles.today,
                    ]}>
                    {s === 'checkin' && foto ? (
                      <>
                        <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        <View style={styles.dayBadge}>
                          <Text variant="overline" color={colors.white}>
                            {dia}
                          </Text>
                        </View>
                      </>
                    ) : s === 'descanso' ? (
                      <>
                        <Ionicons name="bed-outline" size={16} color={colors.text.secondary} />
                        <Text variant="overline" color={colors.text.muted}>
                          {dia}
                        </Text>
                      </>
                    ) : (
                      <Text variant="labelSmall" color={s === 'hoje' ? colors.brand.red : colors.text.muted}>
                        {dia}
                      </Text>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
      </View>

      <View style={styles.legend}>
        <Legend color={colors.brand.green} icon="image" text="Check-in" />
        <Legend color={colors.text.secondary} icon="bed-outline" text="Descanso (1 por semana)" />
        <Legend color={colors.brand.red} icon="ellipse-outline" text="Hoje" />
      </View>
      <Text variant="caption" color={colors.text.muted}>
        A semana vai de segunda a domingo. O primeiro dia sem check-in da semana vira descanso e mantém sua
        sequência; o segundo zera a sequência atual (seus dias ativos e o recorde nunca são zerados).
      </Text>
    </Screen>
  );
}

function Legend({
  color,
  icon,
  text,
}: {
  color: string;
  icon: 'image' | 'bed-outline' | 'ellipse-outline';
  text: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text variant="caption" color={colors.text.secondary}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: -spacing.sm },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rest: { backgroundColor: colors.bg.input },
  today: { borderWidth: 1.5, borderColor: colors.brand.red, backgroundColor: 'transparent' },
  dayBadge: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
});
