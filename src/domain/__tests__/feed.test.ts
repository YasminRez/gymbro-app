import {
  appendPage,
  canComment,
  canPublish,
  COMMENT_MAX,
  FEED_MESSAGES,
  formatDuration,
  Post,
  timeAgo,
  toggleLike,
} from '../feed';
import { dayStatuses, monthGrid } from '../streak';

const post = (id: string, extra: Partial<Post> = {}): Post => ({
  id,
  fotoUrl: 'https://x/a.jpg',
  legenda: null,
  duracaoMin: null,
  modalidade: null,
  academia: null,
  visibilidade: 'academia_conexoes',
  checkin: false,
  data: '2026-11-19',
  criadoEm: '2026-11-19T12:00:00Z',
  minha: false,
  curti: false,
  curtidas: 0,
  comentarios: 0,
  autor: { id: 'a', nome: 'Ana', foto: null, sequencia: 3 },
  ...extra,
});

describe('US-15 — publicar', () => {
  it('sem foto, o botão Publicar fica desabilitado', () => {
    expect(canPublish({ fotoUri: null, legenda: '', duracaoMin: null })).toBe(false);
    expect(FEED_MESSAGES.noPhoto).toBe('Adicione uma foto do seu treino.');
  });
  it('legenda até 300 caracteres', () => {
    expect(canPublish({ fotoUri: 'f', legenda: 'a'.repeat(300), duracaoMin: null })).toBe(true);
    expect(canPublish({ fotoUri: 'f', legenda: 'a'.repeat(301), duracaoMin: null })).toBe(false);
  });
  it('duração entre 1 e 600 minutos (opcional)', () => {
    expect(canPublish({ fotoUri: 'f', legenda: '', duracaoMin: 60 })).toBe(true);
    expect(canPublish({ fotoUri: 'f', legenda: '', duracaoMin: 0 })).toBe(false);
    expect(canPublish({ fotoUri: 'f', legenda: '', duracaoMin: 601 })).toBe(false);
  });
  it('mensagens do check-in e do recorde', () => {
    expect(FEED_MESSAGES.checkinDone(12)).toBe('Dia 12 concluído! 🔥');
    expect(FEED_MESSAGES.newRecord(15)).toBe('Novo recorde: 15 dias seguidos!');
  });
});

describe('RN-020 — comentários', () => {
  it('de 1 a 300 caracteres', () => {
    expect(canComment('Monstro!')).toBe(true);
    expect(canComment('   ')).toBe(false);
    expect(canComment('a'.repeat(COMMENT_MAX + 1))).toBe(false);
  });
});

describe('Formatação', () => {
  it('duração', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(null)).toBeNull();
  });
  it('tempo da publicação', () => {
    const now = new Date('2026-11-19T15:00:00Z');
    expect(timeAgo('2026-11-19T14:59:40Z', now)).toBe('agora');
    expect(timeAgo('2026-11-19T14:40:00Z', now)).toBe('20 min');
    expect(timeAgo('2026-11-19T10:00:00Z', now)).toBe('5 h');
    expect(timeAgo('2026-11-18T12:00:00Z', now)).toBe('ontem');
    expect(timeAgo('2026-11-15T12:00:00Z', now)).toBe('4 d');
  });
});

describe('US-17/US-18 — feed', () => {
  it('curtir e descurtir ajusta o contador', () => {
    const p = post('1', { curtidas: 4 });
    expect(toggleLike(p)).toMatchObject({ curti: true, curtidas: 5 });
    expect(toggleLike(toggleLike(p))).toMatchObject({ curti: false, curtidas: 4 });
  });
  it('carregar mais não repete publicação', () => {
    expect(appendPage([post('1'), post('2')], [post('2'), post('3')]).map((p) => p.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });
});

describe('US-16 — calendário (RN-018)', () => {
  // Semana de seg 16/11 a dom 22/11/2026. Hoje: qui 19/11.
  it('1º dia sem check-in da semana é descanso; o 2º é falta', () => {
    const s = dayStatuses(['2026-11-16', '2026-11-18'], '2026-11-20');
    expect(s['2026-11-16']).toBe('checkin');
    expect(s['2026-11-17']).toBe('descanso');
    expect(s['2026-11-18']).toBe('checkin');
    expect(s['2026-11-19']).toBe('falta');
    expect(s['2026-11-20']).toBe('hoje');
  });
  it('o descanso volta na segunda-feira', () => {
    const s = dayStatuses(['2026-11-21', '2026-11-24'], '2026-11-25');
    expect(s['2026-11-22']).toBe('descanso'); // domingo
    expect(s['2026-11-23']).toBe('descanso'); // segunda: semana nova
  });
  it('sem check-in, calendário vazio', () => {
    expect(dayStatuses([], '2026-11-19')).toEqual({});
  });
  it('grade do mês começa na segunda', () => {
    const g = monthGrid(2026, 11); // 1/11/2026 é domingo
    expect(g[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
});
