import {
  availableHours,
  formatInviteDate,
  Invite,
  inviteActions,
  inviteDate,
  isValidInviteTime,
  nextDays,
  pendingReceived,
  sortUpcoming,
} from '../invite';

// Quinta, 19/11/2026, 14:50 no fuso local
const NOW = new Date(2026, 10, 19, 14, 50);

const invite = (extra: Partial<Invite> = {}): Invite => ({
  id: 'i1',
  conexaoId: 'c1',
  enviado: false,
  status: 'pendente',
  inicio: new Date(2026, 10, 20, 7, 0).toISOString(),
  mensagem: null,
  modalidade: null,
  criadoEm: NOW.toISOString(),
  respondidoEm: null,
  canceladoPorMim: false,
  academia: { id: 'a', placeId: 'osm:way/1', nome: 'Academia', endereco: null },
  pessoa: { id: 'p', nome: 'Ana', foto: null },
  ...extra,
});

describe('RN-025 — horário do convite', () => {
  it('aceita de agora até 30 dias', () => {
    expect(isValidInviteTime(new Date(2026, 10, 19, 18, 0), NOW)).toBe(true);
    expect(isValidInviteTime(new Date(2026, 11, 19, 14, 0), NOW)).toBe(true);
  });
  it('recusa passado e mais de 30 dias', () => {
    expect(isValidInviteTime(new Date(2026, 10, 19, 14, 0), NOW)).toBe(false);
    expect(isValidInviteTime(new Date(2026, 11, 20, 15, 0), NOW)).toBe(false);
  });
  it('hoje só mostra horários a partir de 30 minutos depois de agora', () => {
    expect(availableHours(0, NOW)[0]).toBe(16); // 15h é daqui a 10 min
    expect(availableHours(1, NOW)[0]).toBe(5);
  });
  it('monta a data pelo dia e hora escolhidos', () => {
    const d = inviteDate(2, 7, 0, NOW);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([21, 7, 0]);
  });
});

describe('Datas do convite', () => {
  it('próximos dias', () => {
    const d = nextDays(3, NOW);
    expect(d.map((x) => x.label)).toEqual(['Hoje', 'Amanhã', 'Sáb']);
    expect(d[2].sub).toBe('21/11');
  });
  it('texto da data', () => {
    expect(formatInviteDate(new Date(2026, 10, 19, 19, 0).toISOString(), NOW)).toBe('Hoje às 19:00');
    expect(formatInviteDate(new Date(2026, 10, 20, 7, 0).toISOString(), NOW)).toBe('Amanhã às 07:00');
    expect(formatInviteDate(new Date(2026, 10, 22, 7, 30).toISOString(), NOW)).toBe('Dom, 22/11 às 07:30');
  });
});

describe('Ações do convite', () => {
  it('quem recebe aceita ou recusa um convite pendente', () => {
    expect(inviteActions(invite(), NOW)).toEqual({ accept: true, decline: true, cancel: false });
  });
  it('quem enviou só cancela', () => {
    expect(inviteActions(invite({ enviado: true }), NOW)).toEqual({
      accept: false,
      decline: false,
      cancel: true,
    });
  });
  it('confirmado: os dois podem cancelar antes do horário', () => {
    expect(inviteActions(invite({ status: 'aceito' }), NOW).cancel).toBe(true);
    expect(inviteActions(invite({ status: 'aceito', enviado: true }), NOW).cancel).toBe(true);
  });
  it('depois do horário, nada a fazer', () => {
    const passado = invite({ inicio: new Date(2026, 10, 19, 7, 0).toISOString() });
    expect(inviteActions(passado, NOW)).toEqual({ accept: false, decline: false, cancel: false });
  });
});

describe('Treinos combinados', () => {
  it('recebidos pendentes primeiro, depois confirmados, depois enviados', () => {
    const list = [
      invite({ id: 'enviado', enviado: true, inicio: new Date(2026, 10, 20, 6).toISOString() }),
      invite({ id: 'confirmado', status: 'aceito' }),
      invite({ id: 'recebido', inicio: new Date(2026, 10, 25, 7).toISOString() }),
    ];
    expect(sortUpcoming(list).map((i) => i.id)).toEqual(['recebido', 'confirmado', 'enviado']);
    expect(pendingReceived(list)).toBe(1);
  });
});
