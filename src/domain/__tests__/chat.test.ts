import {
  canSend,
  ChatMessage,
  ConnectionItem,
  dayLabel,
  formatListTime,
  formatMessageTime,
  MESSAGE_MAX,
  mergeMessages,
  newClientId,
  splitConnections,
  totalUnread,
  withDaySeparators,
} from '../chat';

// Datas no fuso local, para o teste não depender do fuso da máquina
const at = (d: number, h = 12, min = 0) => new Date(2026, 10, d, h, min).toISOString();
const NOW = new Date(2026, 10, 19, 15, 0); // quinta, 19/11/2026

const pessoa = (id: string) => ({ id, nome: id, foto: null });
const conn = (id: string, criadaEm: string, ultima?: string, naoLidas = 0): ConnectionItem => ({
  id,
  criadaEm,
  pessoa: pessoa(id),
  ultimaMensagem: ultima ? { conteudo: 'oi', enviadaEm: ultima, minha: false } : null,
  naoLidas,
});
const msg = (id: string, enviadaEm: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conexaoId: 'c1',
  minha: false,
  conteudo: id,
  enviadaEm,
  lidaEm: null,
  ...extra,
});

describe('US-12 — tamanho da mensagem', () => {
  it('aceita de 1 a 1000 caracteres', () => {
    expect(canSend('Bora treinar?')).toBe(true);
    expect(canSend('a'.repeat(MESSAGE_MAX))).toBe(true);
  });
  it('recusa vazia, só espaços ou acima de 1000', () => {
    expect(canSend('')).toBe(false);
    expect(canSend('    ')).toBe(false);
    expect(canSend('a'.repeat(MESSAGE_MAX + 1))).toBe(false);
  });
  it('ignora espaços nas pontas na contagem', () => {
    expect(canSend(`  ${'a'.repeat(MESSAGE_MAX)}  `)).toBe(true);
  });
});

describe('US-11 — ordem da lista de conexões', () => {
  const list = [
    conn('antiga', at(1), at(10)),
    conn('nova-1', at(15)),
    conn('recente', at(2), at(18), 3),
    conn('nova-2', at(17)),
  ];

  it('novas conexões (sem mensagem) ficam separadas, a mais nova primeiro', () => {
    expect(splitConnections(list).novas.map((c) => c.id)).toEqual(['nova-2', 'nova-1']);
  });
  it('conversas ordenadas pela mensagem mais recente', () => {
    expect(splitConnections(list).conversas.map((c) => c.id)).toEqual(['recente', 'antiga']);
  });
  it('soma as não lidas', () => {
    expect(totalUnread(list)).toBe(3);
  });
});

describe('Datas do chat', () => {
  it('horário da mensagem', () => {
    expect(formatMessageTime(at(19, 9, 5))).toBe('09:05');
  });
  it('horário na lista: hoje, ontem, dia da semana e data', () => {
    expect(formatListTime(at(19, 14, 30), NOW)).toBe('14:30');
    expect(formatListTime(at(18), NOW)).toBe('Ontem');
    expect(formatListTime(at(16), NOW)).toBe('seg.');
    expect(formatListTime(at(2), NOW)).toBe('02/11');
  });
  it('separador de dia', () => {
    expect(dayLabel(at(19), NOW)).toBe('Hoje');
    expect(dayLabel(at(18), NOW)).toBe('Ontem');
    expect(dayLabel(at(12), NOW)).toBe('12 de novembro');
    expect(dayLabel(new Date(2025, 11, 31).toISOString(), NOW)).toBe('31 de dezembro de 2025');
  });
});

describe('Lista invertida do chat', () => {
  it('coloca o separador depois da última mensagem de cada dia', () => {
    const rows = withDaySeparators([msg('c', at(19, 10)), msg('b', at(19, 9)), msg('a', at(18, 20))], NOW);
    expect(rows.map((r) => (r.type === 'day' ? r.label : r.msg.id))).toEqual([
      'c',
      'b',
      'Hoje',
      'a',
      'Ontem',
    ]);
  });
});

describe('US-12 — mensagens sem duplicar', () => {
  it('troca a mensagem pendente pela confirmada do servidor (mesmo clientId)', () => {
    const pendente = msg('local-1', at(19, 10), { clientId: 'k1', minha: true, status: 'pendente' });
    const servidor = msg('uuid-1', at(19, 10, 1), { clientId: 'k1', minha: true });
    const out = mergeMessages([pendente], [servidor]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('uuid-1');
    expect(out[0].status).toBeUndefined();
  });
  it('não duplica quando a mesma mensagem chega pelo envio e pelo Realtime', () => {
    const m = msg('uuid-2', at(19, 11), { clientId: 'k2' });
    expect(mergeMessages(mergeMessages([], [m]), [m])).toHaveLength(1);
  });
  it('mantém da mais nova para a mais antiga', () => {
    const out = mergeMessages([msg('a', at(19, 8))], [msg('c', at(19, 12)), msg('b', at(19, 10))]);
    expect(out.map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });
  it('gera ids locais diferentes no formato UUID', () => {
    const a = newClientId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newClientId()).not.toBe(a);
  });
});
