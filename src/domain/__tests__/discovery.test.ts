import { formatSchedule, hasFilters, initials } from '../discovery';

describe('formatSchedule', () => {
  it('mesmo período em vários dias', () => {
    expect(formatSchedule(['1-noite', '3-noite', '5-noite'])).toBe('Seg, Qua e Sex · Noite');
  });
  it('domingo vai para o fim', () => {
    expect(formatSchedule(['0-manha', '6-manha'])).toBe('Sáb e Dom · Manhã');
  });
  it('dois períodos iguais em todos os dias', () => {
    expect(formatSchedule(['2-manha', '2-noite', '4-manha', '4-noite'])).toBe('Ter e Qui · Manhã e noite');
  });
  it('períodos diferentes por dia', () => {
    expect(formatSchedule(['1-manha', '3-noite'])).toBe('Seg manhã, Qua noite');
  });
  it('sem horários', () => expect(formatSchedule([])).toBe('Horários não informados'));
});

describe('auxiliares', () => {
  it('iniciais', () => expect(initials('Lucas Martins Silva')).toBe('LM'));
  it('filtros ativos', () => {
    expect(hasFilters({ periodo: null, modalidade: null, objetivo: null })).toBe(false);
    expect(hasFilters({ periodo: 'noite', modalidade: null, objetivo: null })).toBe(true);
  });
});
