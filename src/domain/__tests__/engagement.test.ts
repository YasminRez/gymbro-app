import {
  canConfirmDeletion,
  daysUntilDeletion,
  daysUntilWeekEnds,
  DEFAULT_NOTIFICATION_PREFS,
  deletionDate,
  groupNotifications,
  notificationTarget,
  notificationText,
  prefForType,
  rankByCheckins,
  shouldNotify,
  weekLabel,
  weekRange,
} from '../engagement';

describe('US-21 · notificações', () => {
  it('liga cada tipo à sua preferência', () => {
    expect(prefForType('conexao')).toBe('matches');
    expect(prefForType('convite_aceito')).toBe('convites');
    expect(prefForType('lembrete_sequencia')).toBe('lembreteSequencia');
    expect(prefForType('outro')).toBeNull();
  });

  it('respeita a preferência desligada', () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, curtidas: false };
    expect(shouldNotify('curtida', prefs)).toBe(false);
    expect(shouldNotify('comentario', prefs)).toBe(true);
    expect(shouldNotify('desconhecido', prefs)).toBe(true);
  });

  it('monta o texto com o primeiro nome', () => {
    expect(notificationText('curtida', 'Ana Souza')).toBe('Ana curtiu seu treino.');
    expect(notificationText('mensagem', null)).toBe('Alguém enviou uma mensagem.');
    expect(notificationText('lembrete_sequencia')).toContain('sequência');
  });

  it('decide para onde a notificação leva', () => {
    const base = { referenciaId: 'p1', conexaoId: null, origem: { id: 'u1', nome: 'Ana', foto: null } };
    expect(notificationTarget({ ...base, tipo: 'curtida' })).toEqual({ kind: 'comments', id: 'p1' });
    expect(notificationTarget({ ...base, tipo: 'mensagem', conexaoId: 'c1' })).toEqual({
      kind: 'chat',
      id: 'c1',
    });
    expect(notificationTarget({ ...base, tipo: 'lembrete_sequencia' })).toEqual({ kind: 'publish' });
    expect(notificationTarget({ ...base, tipo: 'outro', referenciaId: null })).toEqual({
      kind: 'profile',
      id: 'u1',
    });
  });

  it('agrupa em hoje, esta semana e anteriores', () => {
    const now = new Date(2026, 10, 19, 15);
    const g = groupNotifications(
      [
        { criadoEm: new Date(2026, 10, 19, 9).toISOString() },
        { criadoEm: new Date(2026, 10, 16, 9).toISOString() },
        { criadoEm: new Date(2026, 9, 1).toISOString() },
      ],
      now,
    );
    expect(g.map((x) => x.title)).toEqual(['Hoje', 'Esta semana', 'Anteriores']);
  });
});

describe('US-22 · ranking semanal', () => {
  it('semana vai de segunda a domingo', () => {
    expect(weekRange('2026-11-19')).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' });
    expect(weekRange('2026-11-16')).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' });
    expect(weekRange('2026-11-22')).toEqual({ inicio: '2026-11-16', fim: '2026-11-22' });
  });

  it('formata o período e conta os dias restantes', () => {
    expect(weekLabel('2026-11-16', '2026-11-22')).toBe('16 a 22 de nov.');
    expect(weekLabel('2026-11-30', '2026-12-06')).toBe('30 de nov. a 6 de dez.');
    expect(daysUntilWeekEnds('2026-11-22')).toBe(1);
    expect(daysUntilWeekEnds('2026-11-16')).toBe(7);
  });

  it('empate divide a posição', () => {
    const r = rankByCheckins([
      { id: 'a', checkins: 3, ultimo: '2026-11-18T10:00' },
      { id: 'b', checkins: 5, ultimo: '2026-11-18T10:00' },
      { id: 'c', checkins: 3, ultimo: '2026-11-17T10:00' },
      { id: 'd', checkins: 1, ultimo: '2026-11-17T10:00' },
    ]);
    expect(r.map((x) => [x.id, x.posicao])).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 2],
      ['d', 4],
    ]);
  });
});

describe('US-24 · exclusão de conta (RN-022)', () => {
  it('apaga 30 dias depois do pedido', () => {
    const d = deletionDate(new Date('2026-11-19T12:00:00Z'));
    expect(d.toISOString()).toBe('2026-12-19T12:00:00.000Z');
    expect(daysUntilDeletion(d.toISOString(), new Date('2026-11-19T12:00:00Z'))).toBe(30);
    expect(daysUntilDeletion(d.toISOString(), new Date('2027-01-01'))).toBe(0);
  });

  it('só confirma com a palavra EXCLUIR e a senha', () => {
    expect(canConfirmDeletion('excluir', 'x')).toBe(true);
    expect(canConfirmDeletion('EXCLUIR', '')).toBe(false);
    expect(canConfirmDeletion('apagar', 'x')).toBe(false);
  });
});
