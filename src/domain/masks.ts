/**
 * Máscara de data DD/MM/AAAA: o usuário digita só números (teclado numérico,
 * que não tem "/") e as barras entram sozinhas.
 *   "1"        -> "1"
 *   "140"      -> "14/0"
 *   "14031999" -> "14/03/1999"
 * Também aceita texto colado com barras, pontos ou traços.
 */
export function maskDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Converte "DD/MM/AAAA" em Date. Retorna null se a data não existir (ex.: 31/02). */
export function parseBRDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, d, m, y] = match.map(Number);
  const date = new Date(y, m - 1, d);
  const valid = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!valid || y < 1900 || date > new Date()) return null;
  return date;
}

/** Date -> "AAAA-MM-DD" (formato do Postgres), sem mexer com fuso horário. */
export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}
