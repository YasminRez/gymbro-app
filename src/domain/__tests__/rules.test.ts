import { canLike, compatibility, CompatProfile, isAdult, isMutualLike, isStrongPassword } from '../rules';

describe('RN-002 — senha forte', () => {
  it.each(['Gym@2026', 'Abcdef1!'])('aceita %s', (p) => expect(isStrongPassword(p)).toBe(true));
  it.each(['curta1!', 'semnumero!A', 'SEMMINUSC1!', 'semespecial1A'])('recusa %s', (p) =>
    expect(isStrongPassword(p)).toBe(false),
  );
});

describe('RN-004 — idade mínima', () => {
  const today = new Date(2026, 10, 13);
  it('18 anos completos hoje pode', () => expect(isAdult(new Date(2008, 10, 13), today)).toBe(true));
  it('faz 18 amanhã não pode', () => expect(isAdult(new Date(2008, 10, 14), today)).toBe(false));
});

describe('RN-011 — match por curtida mútua', () => {
  it('só cria conexão quando os dois curtiram', () => {
    expect(isMutualLike([{ from: 'a', to: 'b' }], 'a', 'b')).toBe(false);
    expect(
      isMutualLike(
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
        'a',
        'b',
      ),
    ).toBe(true);
  });
});

describe('RN-012 — limite diário de curtidas', () => {
  it('bloqueia a 101ª curtida', () => {
    expect(canLike(99)).toBe(true);
    expect(canLike(100)).toBe(false);
  });
});

describe('RN-024 — compatibilidade', () => {
  const base: CompatProfile = {
    mainGymId: 'g1',
    secondaryGymIds: [],
    slots: [{ day: 1, period: 'noite' }],
    goals: ['hipertrofia'],
    modalities: ['musculacao'],
    interests: ['corrida', 'nutricao', 'crossfit'],
  };

  it('perfis idênticos dão 100%', () => expect(compatibility(base, base)).toBe(100));

  it('academia secundária vale 20 pontos', () => {
    const other = { ...base, mainGymId: 'g2', secondaryGymIds: ['g1'] };
    expect(compatibility(base, other)).toBe(80);
  });

  it('nada em comum dá 0%', () => {
    const other: CompatProfile = {
      mainGymId: 'g9',
      secondaryGymIds: [],
      slots: [{ day: 3, period: 'manha' }],
      goals: ['emagrecimento'],
      modalities: ['funcional'],
      interests: ['yoga', 'ciclismo', 'natacao'],
    };
    expect(compatibility(base, other)).toBe(0);
  });
});
