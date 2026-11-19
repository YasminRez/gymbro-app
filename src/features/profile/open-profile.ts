import { router } from 'expo-router';

/**
 * Abre o perfil de alguém a partir do feed, dos comentários ou da lista de curtidas.
 * O próprio usuário vai para a aba Perfil; os outros, para o perfil completo (D4),
 * que descobre sozinho se vocês já estão conectados (Mensagem / Convidar para treinar).
 */
export function openProfile(userId: string, isMe = false) {
  if (isMe) router.navigate('/perfil');
  else router.push({ pathname: '/perfil/[id]', params: { id: userId } });
}
