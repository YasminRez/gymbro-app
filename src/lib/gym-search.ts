import { distanceKm, Gym } from '@/domain/gyms';

/**
 * Busca de academias no OpenStreetMap (gratuito, sem chave) — US-06.
 * - Por proximidade: Overpass API (leisure=fitness_centre num raio).
 * - Por texto: Nominatim (nome, bairro ou cidade), mesmo fora do raio.
 * As academias escolhidas ficam guardadas no banco (tabela academia), servindo de cache.
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const HEADERS = { 'User-Agent': 'GymBro-App/1.0 (projeto academico UCB)', Accept: 'application/json' };

type OsmTags = Record<string, string | undefined>;

function addressFrom(tags: OsmTags): string {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
  const area = tags['addr:suburb'] ?? tags['addr:neighbourhood'] ?? tags['addr:city'];
  return [street, area].filter(Boolean).join(' · ') || 'Endereço não informado';
}

export async function searchNearbyGyms(lat: number, lng: number, radiusKm: number): Promise<Gym[]> {
  const r = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:25];
    (
      node["leisure"="fitness_centre"](around:${r},${lat},${lng});
      way["leisure"="fitness_centre"](around:${r},${lat},${lng});
      node["sport"="fitness"]["name"](around:${r},${lat},${lng});
    );
    out center tags 80;`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const json = (await res.json()) as {
    elements: {
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: OsmTags;
    }[];
  };

  const seen = new Set<string>();
  return json.elements
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
    .filter((g): g is NonNullable<typeof g> => g !== null && !seen.has(g.placeId) && !!seen.add(g.placeId))
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export async function searchGymsByText(text: string, near?: { lat: number; lng: number }): Promise<Gym[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'br',
    limit: '25',
    q: /academia|gym|fit/i.test(q) ? q : `academia ${q}`,
  });
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = (await res.json()) as {
    osm_type: string;
    osm_id: number;
    lat: string;
    lon: string;
    name: string;
    display_name: string;
    category?: string;
    type?: string;
    address?: Record<string, string>;
  }[];

  return rows
    .filter(
      (r) =>
        r.name &&
        (r.type === 'fitness_centre' || r.type === 'sports_centre' || /academia|gym|fit/i.test(r.name)),
    )
    .map((r) => {
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
