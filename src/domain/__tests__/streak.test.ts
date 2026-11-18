import { computeStreak } from '../streak';

// Semana de referência: 09/11/2026 (segunda) a 15/11/2026 (domingo)
describe('RN-018 — sequência e dia de descanso', () => {
  it('conta dias consecutivos com check-in', () => {
    const s = computeStreak(['2026-11-09', '2026-11-10', '2026-11-11'], '2026-11-11');
    expect(s).toMatchObject({ totalActiveDays: 3, currentStreak: 3, longestStreak: 3 });
  });

  it('um dia sem check-in na semana usa o descanso e mantém a sequência', () => {
    const s = computeStreak(['2026-11-09', '2026-11-11', '2026-11-12'], '2026-11-12');
    expect(s).toMatchObject({ totalActiveDays: 3, currentStreak: 3, restUsedThisWeek: true });
  });

  it('o segundo dia sem check-in na mesma semana zera a sequência', () => {
    const s = computeStreak(['2026-11-09', '2026-11-11', '2026-11-13'], '2026-11-13');
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(2);
    expect(s.totalActiveDays).toBe(3);
  });

  it('o descanso volta na semana seguinte', () => {
    const s = computeStreak(
      ['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17'],
      '2026-11-17',
    );
    expect(s.currentStreak).toBe(7);
  });

  it('hoje sem check-in ainda não conta como falta', () => {
    const s = computeStreak(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-13');
    expect(s.currentStreak).toBe(3);
    expect(s.restUsedThisWeek).toBe(false);
  });

  it('sem publicações, tudo zerado', () => {
    expect(computeStreak([], '2026-11-13').currentStreak).toBe(0);
  });
});
