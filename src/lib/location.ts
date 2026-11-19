import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * Localização para a busca de academias (US-03, US-06, RN-008).
 *
 * Por que existe: o getCurrentPositionAsync sozinho pode ficar "pendurado" para
 * sempre (comum no Android e no Expo Go, dentro de casa ou com o GPS frio), e
 * GPS desligado era tratado como "permissão negada". Aqui:
 *  1. separamos permissão negada de GPS desligado;
 *  2. usamos a última posição conhecida (resposta instantânea);
 *  3. pedimos a posição atual com tempo limite e, se demorar, caímos na última conhecida.
 * A posição nunca é guardada: só é usada na hora da busca.
 */

export type Coords = { lat: number; lng: number };

export type LocationResult =
  | { status: 'ok'; coords: Coords }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'services-off' }
  | { status: 'unavailable' };

const CURRENT_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000; // 10 minutos

const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[localização]', ...args);
};

const toCoords = (p: Location.LocationObject): Coords => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function getCurrentCoords({ ask = true }: { ask?: boolean } = {}): Promise<LocationResult> {
  // 1. Permissão (pede de novo se o sistema ainda deixar)
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { status: 'denied', canAskAgain: perm.canAskAgain };
  log('permissão ok');

  // 2. GPS / serviços de localização ligados?
  const servicesOn =
    (await withTimeout(
      Location.hasServicesEnabledAsync().catch(() => true),
      3_000,
    )) ?? true;
  if (!servicesOn) return { status: 'services-off' };

  // 3. Última posição conhecida recente: resposta imediata
  const recent = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(
    () => null,
  );
  if (recent) return { status: 'ok', coords: toCoords(recent) };

  // 4. Posição atual com tempo limite (Balanced usa Wi-Fi/rede e responde rápido)
  const current = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    CURRENT_TIMEOUT_MS,
  );
  if (current) return { status: 'ok', coords: toCoords(current) };

  // 5. Qualquer última posição, mesmo antiga (academias não mudam de lugar)
  const old = await Location.getLastKnownPositionAsync().catch(() => null);
  if (old) return { status: 'ok', coords: toCoords(old) };

  return { status: 'unavailable' };
}

/** Android: abre o diálogo do sistema para ligar a localização. iOS: abre os Ajustes. */
export async function turnOnLocationServices() {
  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
      return;
    } catch {
      // usuário recusou ou o aparelho não suporta: cai nos ajustes
    }
  }
  await Linking.openSettings();
}
