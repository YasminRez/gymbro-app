import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { applyLink, Gym, GYM_MESSAGES, GymLink, GymRuleError } from '@/domain/gyms';
import { Disponibilidade, Foto, Nivel, ProfileData } from '@/domain/profile';
import { SEARCH_RADIUS_KM } from '@/domain/rules';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Perfil, academias e preferências (US-04 a US-07).
 * Mesmo esquema da autenticação: Supabase quando configurado, memória no modo demonstração.
 */

export type Preferences = {
  idadeMin: number;
  idadeMax: number;
  generos: string[];
  distanciaKm: number;
  somenteMinhaAcademia: boolean;
  visivel: boolean;
};

export const defaultPreferences: Preferences = {
  idadeMin: 18,
  idadeMax: 60,
  generos: [],
  distanciaKm: SEARCH_RADIUS_KM.default,
  somenteMinhaAcademia: false,
  visivel: true,
};

export class ProfileError extends Error {}

export const PROFILE_MESSAGES = {
  created: 'Perfil criado! Agora escolha a sua academia.',
  updated: 'Perfil atualizado com sucesso!',
  prefsSaved: 'Preferências salvas.',
  uploadFailed: 'Não foi possível enviar as fotos. Verifique sua internet e tente de novo.',
  generic: 'Não foi possível salvar agora. Tente de novo.',
} as const;

type ProfileApi = {
  load(userId: string): Promise<ProfileData | null>;
  save(userId: string, data: ProfileData): Promise<ProfileData>;
  loadGyms(userId: string): Promise<GymLink[]>;
  linkGym(gym: Gym, tipo: 'principal' | 'secundaria'): Promise<Gym>;
  suggestGym(nome: string, endereco: string, coords?: { lat: number; lng: number }): Promise<Gym>;
  removeSecondary(placeId: string): Promise<void>;
  countUsers(placeIds: string[]): Promise<Record<string, number>>;
  loadPreferences(userId: string): Promise<Preferences>;
  savePreferences(userId: string, prefs: Preferences): Promise<void>;
};

/* ------------------------------------------------------------------ */
/* Fotos: redimensiona e comprime no aparelho antes de enviar (RNF-007) */
/* ------------------------------------------------------------------ */

export async function compressPhoto(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1080 });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return result.uri;
}

async function uploadPhoto(userId: string, foto: Foto, index: number): Promise<string> {
  if (!foto.local) return foto.uri;
  const body = await (await fetch(foto.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}-${index}.jpg`;
  const { error } = await supabase.storage
    .from('fotos-perfil')
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new ProfileError(PROFILE_MESSAGES.uploadFailed);
  return supabase.storage.from('fotos-perfil').getPublicUrl(path).data.publicUrl;
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

type GymRow = {
  id: string;
  nome: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  place_id: string | null;
  status: 'aprovada' | 'pendente';
};

const rowToGym = (a: GymRow): Gym => ({
  placeId: a.place_id ?? `gymbro:${a.id}`,
  nome: a.nome,
  endereco: a.endereco ?? '',
  lat: a.latitude,
  lng: a.longitude,
  status: a.status,
});

function gymError(message: string): Error {
  if (message.includes('JA_PRINCIPAL')) return new GymRuleError(GYM_MESSAGES.alreadyMain);
  if (message.includes('LIMITE_SECUNDARIAS')) return new GymRuleError(GYM_MESSAGES.maxSecondary);
  const wait = /AGUARDE_TROCA:(\d+)/.exec(message);
  if (wait) return new GymRuleError(GYM_MESSAGES.wait(Number(wait[1])));
  return new ProfileError(PROFILE_MESSAGES.generic);
}

const supabaseApi: ProfileApi = {
  async load(userId) {
    const { data, error } = await supabase
      .from('usuario')
      .select(
        `bio, genero, nivel,
         foto_perfil (url, ordem),
         usuario_modalidade (modalidade (nome)),
         usuario_objetivo (objetivo (nome)),
         usuario_interesse (interesse (nome)),
         disponibilidade (dia_semana, periodo)`,
      )
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    type Named = { nome: string } | { nome: string }[] | null;
    const nome = (n: Named) => (Array.isArray(n) ? n[0]?.nome : n?.nome) ?? '';
    return {
      bio: data.bio ?? '',
      genero: data.genero,
      nivel: data.nivel as Nivel | null,
      fotos: [...(data.foto_perfil ?? [])].sort((a, b) => a.ordem - b.ordem).map((f) => ({ uri: f.url })),
      modalidades: (data.usuario_modalidade ?? []).map((m: { modalidade: Named }) => nome(m.modalidade)),
      objetivos: (data.usuario_objetivo ?? []).map((o: { objetivo: Named }) => nome(o.objetivo)),
      interesses: (data.usuario_interesse ?? []).map((i: { interesse: Named }) => nome(i.interesse)),
      disponibilidade: (data.disponibilidade ?? []).map(
        (d: { dia_semana: number; periodo: string }) =>
          ({ dia: d.dia_semana, periodo: d.periodo }) as Disponibilidade,
      ),
    };
  },

  async save(userId, data) {
    const urls = await Promise.all(data.fotos.map((f, i) => uploadPhoto(userId, f, i)));
    const { error } = await supabase.rpc('salvar_perfil', {
      p: {
        bio: data.bio.trim(),
        genero: data.genero,
        nivel: data.nivel,
        fotos: urls,
        modalidades: data.modalidades,
        objetivos: data.objetivos,
        interesses: data.interesses,
        disponibilidade: data.disponibilidade,
      },
    });
    if (error) throw new ProfileError(PROFILE_MESSAGES.generic);
    return { ...data, fotos: urls.map((uri) => ({ uri })) };
  },

  async loadGyms(userId) {
    const { data } = await supabase
      .from('usuario_academia')
      .select('tipo, desde, academia (id, nome, endereco, latitude, longitude, place_id, status)')
      .eq('usuario_id', userId);
    return (data ?? [])
      .map((r) => {
        const a = (Array.isArray(r.academia) ? r.academia[0] : r.academia) as GymRow | null;
        return a ? { gym: rowToGym(a), tipo: r.tipo as GymLink['tipo'], desde: r.desde } : null;
      })
      .filter((x): x is GymLink => x !== null)
      .sort((a) => (a.tipo === 'principal' ? -1 : 1));
  },

  async linkGym(gym, tipo) {
    const { error } = await supabase.rpc('definir_academia', {
      p_place_id: gym.placeId,
      p_nome: gym.nome,
      p_endereco: gym.endereco,
      p_lat: gym.lat,
      p_lng: gym.lng,
      p_tipo: tipo,
    });
    if (error) throw gymError(error.message);
    return gym;
  },

  async suggestGym(nome, endereco, coords) {
    const { data: id, error } = await supabase.rpc('sugerir_academia', {
      p_nome: nome,
      p_endereco: endereco,
      p_lat: coords?.lat ?? null,
      p_lng: coords?.lng ?? null,
    });
    if (error || !id) throw new ProfileError(PROFILE_MESSAGES.generic);
    const gym: Gym = {
      placeId: `gymbro:${id}`,
      nome,
      endereco,
      lat: coords?.lat ?? 0,
      lng: coords?.lng ?? 0,
      status: 'pendente',
    };
    await this.linkGym(gym, 'principal');
    return gym;
  },

  async removeSecondary(placeId) {
    const { data: links } = await supabase
      .from('usuario_academia')
      .select('academia_id, academia!inner (place_id)')
      .eq('tipo', 'secundaria');
    const target = (links ?? []).find((l) => {
      const a = (Array.isArray(l.academia) ? l.academia[0] : l.academia) as {
        place_id: string | null;
      } | null;
      return a?.place_id === placeId || `gymbro:${l.academia_id}` === placeId;
    });
    if (!target) return;
    await supabase
      .from('usuario_academia')
      .delete()
      .eq('academia_id', target.academia_id)
      .eq('tipo', 'secundaria');
  },

  async countUsers(placeIds) {
    if (placeIds.length === 0) return {};
    const { data } = await supabase.rpc('contar_usuarios_academias', { p_place_ids: placeIds });
    return Object.fromEntries(
      ((data ?? []) as { place_id: string; usuarios: number }[]).map((r) => [r.place_id, Number(r.usuarios)]),
    );
  },

  async loadPreferences(userId) {
    const { data } = await supabase
      .from('preferencia_descoberta')
      .select('*')
      .eq('usuario_id', userId)
      .maybeSingle();
    if (!data) return defaultPreferences;
    return {
      idadeMin: data.idade_min,
      idadeMax: data.idade_max,
      generos: data.generos ?? [],
      distanciaKm: data.distancia_max_km,
      somenteMinhaAcademia: data.somente_minha_academia,
      visivel: data.visivel,
    };
  },

  async savePreferences(userId, p) {
    const { error } = await supabase.from('preferencia_descoberta').upsert({
      usuario_id: userId,
      idade_min: p.idadeMin,
      idade_max: p.idadeMax,
      generos: p.generos,
      distancia_max_km: p.distanciaKm,
      somente_minha_academia: p.somenteMinhaAcademia,
      visivel: p.visivel,
    });
    if (error) throw new ProfileError(PROFILE_MESSAGES.generic);
  },
};

/* ------------------------------------------------------------------ */
/* Modo demonstração                                                   */
/* ------------------------------------------------------------------ */

const demo = {
  profiles: new Map<string, ProfileData>(),
  gyms: new Map<string, GymLink[]>(),
  prefs: new Map<string, Preferences>(),
  current: '' as string,
};
const wait = () => new Promise((r) => setTimeout(r, 300));

const demoApi: ProfileApi = {
  async load(userId) {
    demo.current = userId;
    return demo.profiles.get(userId) ?? null;
  },
  async save(userId, data) {
    await wait();
    const saved = { ...data, fotos: data.fotos.map((f) => ({ uri: f.uri })) };
    demo.profiles.set(userId, saved);
    return saved;
  },
  async loadGyms(userId) {
    demo.current = userId;
    return demo.gyms.get(userId) ?? [];
  },
  async linkGym(gym, tipo) {
    await wait();
    const links = demo.gyms.get(demo.current) ?? [];
    demo.gyms.set(demo.current, applyLink(links, gym, tipo));
    return gym;
  },
  async suggestGym(nome, endereco, coords) {
    const gym: Gym = {
      placeId: `gymbro:demo-${Date.now()}`,
      nome,
      endereco,
      lat: coords?.lat ?? 0,
      lng: coords?.lng ?? 0,
      status: 'pendente',
    };
    return this.linkGym(gym, 'principal');
  },
  async removeSecondary(placeId) {
    const links = demo.gyms.get(demo.current) ?? [];
    demo.gyms.set(
      demo.current,
      links.filter((l) => !(l.tipo === 'secundaria' && l.gym.placeId === placeId)),
    );
  },
  async countUsers() {
    return {};
  },
  async loadPreferences(userId) {
    return demo.prefs.get(userId) ?? defaultPreferences;
  },
  async savePreferences(userId, prefs) {
    await wait();
    demo.prefs.set(userId, prefs);
  },
};

export const profileApi: ProfileApi = isSupabaseConfigured ? supabaseApi : demoApi;
