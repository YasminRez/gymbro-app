import {
  applyLink,
  daysUntilMainChange,
  distanceKm,
  formatDistance,
  Gym,
  GymLink,
  GymRuleError,
  roundedPersonDistance,
} from '../gyms';
import {
  emptyProfile,
  isProfileValid,
  makeMain,
  missingForDiscovery,
  missingStep1,
  missingStep2,
  missingStep3,
  movePhoto,
  ProfileData,
  toggle,
} from '../profile';

const full: ProfileData = {
  fotos: [{ uri: 'a' }],
  bio: 'Treino de manhã',
  genero: 'Homem',
  modalidades: ['Musculação'],
  objetivos: ['Hipertrofia'],
  nivel: 'intermediario',
  disponibilidade: [{ dia: 1, periodo: 'manha' }],
  interesses: ['Corrida', 'Nutrição', 'Música'],
};

describe('US-04 — etapas do perfil', () => {
  it('perfil vazio aponta o que falta em cada etapa', () => {
    expect(missingStep1(emptyProfile)).toEqual(['ao menos 1 foto', 'bio', 'gênero']);
    expect(missingStep2(emptyProfile)).toEqual([
      'modalidade',
      'objetivo',
      'nível',
      'dia e período de treino',
    ]);
    expect(missingStep3(emptyProfile)).toEqual(['mais 3 interesse(s)']);
  });

  it('perfil completo é válido', () => expect(isProfileValid(full)).toBe(true));

  it('RN-007: bio acima de 500 caracteres bloqueia', () => {
    expect(missingStep1({ ...full, bio: 'x'.repeat(501) })).toContain('bio com até 500 caracteres');
  });

  it('RN-007: no máximo 10 interesses', () => {
    const dez = Array.from({ length: 10 }, (_, i) => `i${i}`);
    expect(toggle(dez, 'novo', 10)).toHaveLength(10);
    expect(toggle(dez, 'i0', 10)).toHaveLength(9);
  });

  it('foto escolhida vira a principal e dá para reordenar', () => {
    const f = [{ uri: '1' }, { uri: '2' }, { uri: '3' }];
    expect(makeMain(f, 2).map((x) => x.uri)).toEqual(['3', '1', '2']);
    expect(movePhoto(f, 0, 1).map((x) => x.uri)).toEqual(['2', '1', '3']);
    expect(movePhoto(f, 0, -1)).toBe(f);
  });
});

describe('RN-006 — perfil mínimo para a descoberta', () => {
  it('lista o que falta', () => {
    expect(missingForDiscovery(null, false)).toEqual([
      'foto',
      'modalidade',
      'objetivo',
      'periodo',
      'academia',
    ]);
    expect(missingForDiscovery(full, false)).toEqual(['academia']);
    expect(missingForDiscovery(full, true)).toEqual([]);
  });
});

describe('academias', () => {
  it('distância entre Taguatinga e a Esplanada (~19 km)', () => {
    const d = distanceKm(-15.8337, -48.0567, -15.7942, -47.8822); // Taguatinga → Esplanada
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(20);
  });

  it('formata a distância', () => {
    expect(formatDistance(0.34)).toBe('350 m');
    expect(formatDistance(1.24)).toBe('1,2 km');
    expect(formatDistance(12.6)).toBe('13 km');
  });

  it('RN-008: distância de pessoas arredondada para 1 km', () => {
    expect(roundedPersonDistance(0.2)).toBe(1);
    expect(roundedPersonDistance(2.6)).toBe(3);
  });
});

describe('RN-009 — vínculo com academias', () => {
  const g = (id: string): Gym => ({ placeId: id, nome: id, endereco: '', lat: 0, lng: 0 });
  const now = new Date('2026-11-18T12:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  it('define a primeira principal', () => {
    expect(applyLink([], g('A'), 'principal', now)).toMatchObject([{ tipo: 'principal' }]);
  });

  it('só troca a principal depois de 7 dias', () => {
    const links: GymLink[] = [{ gym: g('A'), tipo: 'principal', desde: ago(3) }];
    expect(() => applyLink(links, g('B'), 'principal', now)).toThrow('novamente em 4 dias');
    const old: GymLink[] = [{ gym: g('A'), tipo: 'principal', desde: ago(8) }];
    expect(applyLink(old, g('B'), 'principal', now)[0].gym.placeId).toBe('B');
  });

  it('aceita no máximo 2 secundárias', () => {
    let links: GymLink[] = [{ gym: g('A'), tipo: 'principal', desde: ago(1) }];
    links = applyLink(links, g('B'), 'secundaria', now);
    links = applyLink(links, g('C'), 'secundaria', now);
    expect(() => applyLink(links, g('D'), 'secundaria', now)).toThrow(GymRuleError);
  });

  it('a principal não pode ser secundária ao mesmo tempo', () => {
    const links: GymLink[] = [{ gym: g('A'), tipo: 'principal', desde: ago(1) }];
    expect(() => applyLink(links, g('A'), 'secundaria', now)).toThrow(GymRuleError);
  });

  it('dias restantes', () => {
    expect(daysUntilMainChange(new Date(ago(6.5)), now)).toBe(1);
    expect(daysUntilMainChange(new Date(ago(7)), now)).toBe(0);
  });
});
