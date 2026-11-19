import { Image } from 'expo-image';
import { View } from 'react-native';

import { Avatar } from '@/features/discovery/profile-card';
import { colors } from '@/theme';

/** Foto redonda da pessoa (ou as iniciais), com anel verde opcional para conexões novas */
export function PersonAvatar({
  nome,
  foto,
  size = 52,
  ring = false,
}: {
  nome: string;
  foto: string | null;
  size?: number;
  ring?: boolean;
}) {
  const inner = ring ? size - 6 : size;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: colors.brand.green,
      }}>
      {foto ? (
        <Image
          source={{ uri: foto }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
          contentFit="cover"
          accessibilityLabel={`Foto de ${nome}`}
        />
      ) : (
        <Avatar nome={nome} size={inner} />
      )}
    </View>
  );
}
