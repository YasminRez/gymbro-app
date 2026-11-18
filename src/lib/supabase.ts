import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { secureStorage } from './secure-storage';

/**
 * Cliente do Supabase (autenticação, banco, storage e realtime).
 * As chaves vêm do arquivo .env (copie .env.example para .env e preencha).
 * Variáveis com prefixo EXPO_PUBLIC_ ficam visíveis no app: use só a chave "anon".
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = url.startsWith('https://') && anonKey.length > 20;

export const supabase = createClient(url || 'https://demo.supabase.co', anonKey || 'public-anon-key', {
  auth: {
    // No celular, o token fica no cofre seguro (expo-secure-store). Na web, no localStorage.
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
