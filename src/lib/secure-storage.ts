import * as SecureStore from 'expo-secure-store';

/**
 * Armazenamento da sessão no cofre seguro do aparelho (RNF-003, US-02).
 * O SecureStore recomenda valores pequenos, e a sessão do Supabase passa disso,
 * então o valor é dividido em pedaços de até 1800 caracteres.
 */
const CHUNK = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (count === null) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`)),
    );
    if (parts.some((p) => p === null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await this.removeItem(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${k}.${i}`, p)));
    await SecureStore.setItemAsync(`${k}.n`, String(parts.length));
  },

  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (count === null) return;
    await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.deleteItemAsync(`${k}.${i}`)),
    );
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};
