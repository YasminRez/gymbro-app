import { initialAttempts, isLocked, registerAttempt } from '../login-attempts';
import { maskDate, parseBRDate, toISODate } from '../masks';

describe('máscara de data de nascimento', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['14', '14'],
    ['140', '14/0'],
    ['1403', '14/03'],
    ['14031', '14/03/1'],
    ['14031999', '14/03/1999'],
    ['140319991', '14/03/1999'], // ignora o excesso
    ['14/03/1999', '14/03/1999'], // colado com barras
    ['14.03.1999', '14/03/1999'],
  ])('"%s" vira "%s"', (input, expected) => expect(maskDate(input)).toBe(expected));

  it('apagar a barra remove o dígito anterior junto (texto continua válido)', () => {
    expect(maskDate('14/')).toBe('14');
  });
});

describe('parseBRDate', () => {
  it('lê uma data válida', () => {
    expect(toISODate(parseBRDate('14/03/1999')!)).toBe('1999-03-14');
  });
  it.each(['31/02/2000', '00/01/2000', '14/13/1999', '1/3/1999', '14/03/1899'])('recusa %s', (v) =>
    expect(parseBRDate(v)).toBeNull(),
  );
  it('recusa data no futuro', () => {
    expect(parseBRDate('01/01/2999')).toBeNull();
  });
});

describe('RN-023 — bloqueio de login', () => {
  const t0 = 1_000_000;

  it('bloqueia na 5ª falha seguida por 5 minutos', () => {
    let s = initialAttempts;
    for (let i = 0; i < 4; i++) s = registerAttempt(s, false, t0);
    expect(isLocked(s, t0)).toBe(false);
    s = registerAttempt(s, false, t0);
    expect(isLocked(s, t0)).toBe(true);
    expect(isLocked(s, t0 + 4 * 60_000)).toBe(true);
    expect(isLocked(s, t0 + 5 * 60_000)).toBe(false);
  });

  it('um login certo zera a contagem', () => {
    let s = initialAttempts;
    for (let i = 0; i < 4; i++) s = registerAttempt(s, false, t0);
    s = registerAttempt(s, true, t0);
    expect(s.failures).toBe(0);
  });

  it('depois que o bloqueio expira, recomeça do zero', () => {
    let s = initialAttempts;
    for (let i = 0; i < 5; i++) s = registerAttempt(s, false, t0);
    s = registerAttempt(s, false, t0 + 6 * 60_000);
    expect(s.failures).toBe(1);
    expect(isLocked(s, t0 + 6 * 60_000)).toBe(false);
  });
});
