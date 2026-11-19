import { distanceKm, Gym } from '@/domain/gyms';

/**
 * Busca de academias no OpenStreetMap (gratuito, sem chave) — US-06.
 *
 * Fonte principal: Nominatim (responde em menos de 1 s). Testado em 19/11/2026:
 * 18 academias num raio de 5 km em Taguatinga/DF.
 * Complemento: Overpass, que acha mais lugares, mas vive sobrecarregado (no mesmo
 * teste: 502 "at capacity", 504 e dois servidores sem responder por mais de 25 s).
 * Por isso o Overpass roda em paralelo, em vários servidores ao mesmo tempo, e
 * a tela espera por ele no máximo OVERPASS_WAIT_MS. Se não chegar, fica só o Nominatim.
 *
 * As academias escolhidas ficam guardadas no banco (tabela academia), servindo de cache.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const HEADERS = { 'User-Agent': 'GymBro-App/1.0 (projeto academico UCB)', Accept: 'application/json' };
const NOMINATIM_TIMEOUT_MS = 8_000;
const OVERPASS_WAIT_MS = 6_000;
/** Política do Nominatim: no máximo 1 pedido por segundo */
const NOMINATIM_GAP_MS = 1_100;

/** Tipos do OSM que contam como academia */
const GYM_TYPES = new Set(['fitness_centre', 'sports_centre', 'dojo', 'gym']);
const GYM_NAME = /academia|gym|fit|crossfit|muscula|treino|box\b/i;

const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[academias]', ...args);
};

/** Primeira promessa que der certo (igual ao Promise.any, sem depender da versão do motor JS) */
function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let failed = 0;
    promises.forEach((p) =>
      p.then(resolve, (e) => {
        failed++;
        if (failed === promises.length) reject(e);
      }),
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch com tempo limite: sem isso, um servidor lento deixa a tela carregando para sempre */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Nominatim ---------------- */

type NominatimRow = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
};

function isGym(r: NominatimRow) {
  if (!r.name) return false;
  if (r.type && GYM_TYPES.has(r.type)) return true;
  // nome com "academia/fit/gym", mas só em categorias de esporte/lazer (evita lanchonete "Fit Food")
  return (
    (r.category === 'leisure' || r.category === 'sport') &&
    r.type !== 'fitness_station' &&
    GYM_NAME.test(r.name)
  );
}

function fromNominatim(rows: NominatimRow[], near?: { lat: number; lng: number }): Gym[] {
  return rows.filter(isGym).map((r) => {
    const a = r.address ?? {};
    const endereco =
      [[a.road, a.house_number].filter(Boolean).join(', '), a.suburb ?? a.city_district, a.city ?? a.town]
        .filter(Boolean)
        .join(' · ') || r.display_name;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    return {
      placeId: `osm:${r.osm_type}/${r.osm_id}`,
      nome: r.name,
      endereco,
      lat,
      lng,
      distanciaKm: near ? distanceKm(near.lat, near.lng, lat, lng) : undefined,
    } satisfies Gym;
  });
}

async function nominatim(params: Record<string, string>): Promise<NominatimRow[]> {
  const qs = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', countrycodes: 'br', ...params });
  const res = await fetchWithTimeout(`${NOMINATIM}?${qs}`, { headers: HEADERS }, NOMINATIM_TIMEOUT_MS);
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  return (await res.json()) as NominatimRow[];
}

/** "academia", "gym" e "crossfit" dentro de um quadrado do tamanho do raio, um pedido por segundo */
async function nearbyByNominatim(lat: number, lng: number, radiusKm: number): Promise<Gym[]> {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const viewbox = [lng - dLng, lat + dLat, lng + dLng, lat - dLat].join(',');
  const rows: NominatimRow[] = [];
  let failures = 0;
  const termos = ['academia', 'gym', 'crossfit'];
  for (const [i, q] of termos.entries()) {
    if (i > 0) await sleep(NOMINATIM_GAP_MS);
    try {
      rows.push(...(await nominatim({ q, viewbox, bounded: '1', limit: '50' })));
    } catch (e) {
      failures++;
      log('nominatim falhou', q, String(e));
    }
  }
  if (failures === termos.length) throw new Error('nominatim indisponível');
  return fromNominatim(rows, { lat, lng });
}

/* ---------------- Overpass (complemento) ---------------- */

type OsmTags = Record<string, string | undefined>;
type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

function addressFrom(tags: OsmTags): string {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
  const area = tags['addr:suburb'] ?? tags['addr:neighbourhood'] ?? tags['addr:city'];
  return [street, area].filter(Boolean).join(' · ') || 'Endereço não informado';
}

/** Pergunta a todos os servidores ao mesmo tempo e fica com o primeiro que responder certo */
async function nearbyByOverpass(lat: number, lng: number, radiusKm: number): Promise<Gym[]> {
  const r = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:20];(nwr["leisure"="fitness_centre"](around:${r},${lat},${lng});nwr["sport"="fitness"]["name"](around:${r},${lat},${lng}););out center tags 100;`;
  const elements = await firstSuccess(
    OVERPASS_SERVERS.map(async (server) => {
      const res = await fetchWithTimeout(
        server,
        {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        OVERPASS_WAIT_MS,
      );
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      return ((await res.json()) as { elements?: OverpassElement[] }).elements ?? [];
    }),
  );
  return elements
    .map((e) => {
      const p = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
      const nome = e.tags?.name;
      if (!p || !nome) return null;
      return {
        placeId: `osm:${e.type}/${e.id}`,
        nome,
        endereco: addressFrom(e.tags ?? {}),
        lat: p.lat,
        lng: p.lon,
        distanciaKm: distanceKm(lat, lng, p.lat, p.lon),
      } satisfies Gym;
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}

/* ---------------- API usada pelas telas ---------------- */

export async function searchNearbyGyms(lat: number, lng: number, radiusKm: number): Promise<Gym[]> {
  const t0 = Date.now();
  const overpass = nearbyByOverpass(lat, lng, radiusKm).catch((e) => {
    log('overpass sem resposta', String(e));
    return [] as Gym[];
  });
  const [fromNominatim, fromOverpass] = await Promise.allSettled([
    nearbyByNominatim(lat, lng, radiusKm),
    overpass,
  ]);
  const a = fromNominatim.status === 'fulfilled' ? fromNominatim.value : [];
  const b = fromOverpass.status === 'fulfilled' ? fromOverpass.value : [];
  log(`nominatim=${a.length} overpass=${b.length} em ${Date.now() - t0} ms`);
  if (fromNominatim.status === 'rejected' && b.length === 0) throw fromNominatim.reason;

  // Junta as duas fontes sem repetir (mesmo id do OSM ou mesmo nome a menos de 80 m)
  const merged: Gym[] = [];
  for (const g of [...b, ...a]) {
    const dup = merged.some(
      (m) =>
        m.placeId === g.placeId ||
        (m.nome.toLowerCase() === g.nome.toLowerCase() && distanceKm(m.lat, m.lng, g.lat, g.lng) < 0.08),
    );
    if (!dup) merged.push(g);
  }
  return merged
    .filter((g) => (g.distanciaKm ?? 0) <= radiusKm)
    .sort((x, y) => (x.distanciaKm ?? 0) - (y.distanciaKm ?? 0));
}

export async function searchGymsByText(text: string, near?: { lat: number; lng: number }): Promise<Gym[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const rows = await nominatim({ limit: '25', q: GYM_NAME.test(q) ? q : `academia ${q}` });
  const list = fromNominatim(rows, near);
  return near ? list.sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0)) : list;
}
