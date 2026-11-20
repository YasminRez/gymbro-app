import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewInstance,
  StatusBar,
  StyleProp,
  TextInput,
  View,
  ViewInstance,
  ViewStyle,
} from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * Teclado sem tampar campos (RNF-008/RNF-011).
 *
 * No Android o app é edge-to-edge: a janela não encolhe quando o teclado abre.
 * O KeyboardAvoidingView do React Native calcula o deslocamento pelo screenY do
 * teclado, que no Android edge-to-edge pode vir sem descontar o teclado (aí o
 * deslocamento dá 0 e a tela não sobe). O KeyboardAvoider abaixo calcula pela
 * altura do teclado e pela posição real da view na janela, nas duas plataformas.
 * O KeyboardAwareScroll rola até o campo focado, com folga, quando o teclado
 * abre, quando a área muda de tamanho ou quando outro campo recebe foco.
 */

/** Espaço livre entre o campo e o teclado */
const GAP = 24;

type Ensure = () => void;
const noop = () => undefined;
const KeyboardScrollContext = createContext<Ensure | null>(null);

/** Chamar no onFocus de um campo para garantir que ele fique visível */
export function useEnsureFocusedVisible(): Ensure {
  return useContext(KeyboardScrollContext) ?? noop;
}

/** Topo do teclado em coordenadas da janela */
function keyboardTop(e: KeyboardEvent): number {
  if (Platform.OS === 'ios') return e.endCoordinates.screenY;
  // Android: a altura informada já desconta a barra de navegação
  const navBar = initialWindowMetrics?.insets.bottom ?? 0;
  return Dimensions.get('screen').height - navBar - e.endCoordinates.height;
}

/**
 * Substitui o KeyboardAvoidingView: adiciona embaixo exatamente o espaço que o
 * teclado cobre desta view, para o conteúdo e o rodapé ficarem acima dele.
 */
export function KeyboardAvoider({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<ViewInstance>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onShow = (e: KeyboardEvent) => {
      const top = keyboardTop(e);
      ref.current?.measureInWindow((_x, y, _w, h) => {
        // Android: measureInWindow conta a partir de baixo da barra de status
        const offset = ios ? 0 : (StatusBar.currentHeight ?? 0);
        const next = Math.max(0, Math.round(y + h + offset - top));
        if (ios && e.duration) {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { type: LayoutAnimation.Types.keyboard },
          });
        }
        setPad(next);
      });
    };
    const onHide = (e: KeyboardEvent) => {
      if (ios && e?.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setPad(0);
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return (
    <View ref={ref} style={[{ flex: 1 }, style, { paddingBottom: pad }]}>
      {children}
    </View>
  );
}

type Measurable = {
  measureLayout?: (
    relativeTo: ViewInstance,
    onSuccess: (x: number, y: number, w: number, h: number) => void,
    onFail?: () => void,
  ) => void;
};

export function KeyboardAwareScroll({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  const viewport = useRef(0);
  const offset = useRef(0);
  const keyboardOpen = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measureNow = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput() as unknown as Measurable | null;
    const content = contentRef.current;
    if (!input?.measureLayout || !content || viewport.current <= 0) return;
    input.measureLayout(
      content,
      (_x, y, _w, h) => {
        const top = offset.current;
        const bottom = top + viewport.current;
        if (y + h + GAP > bottom) {
          scrollRef.current?.scrollTo({ y: y + h + GAP - viewport.current, animated: true });
        } else if (y - GAP < top) {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - GAP), animated: true });
        }
      },
      noop,
    );
  }, []);

  // Espera o KeyboardAvoidingView aplicar o padding antes de medir
  const ensureVisible = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(measureNow, 120);
  }, [measureNow]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      keyboardOpen.current = true;
      ensureVisible();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOpen.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ensureVisible]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewport.current = e.nativeEvent.layout.height;
      if (keyboardOpen.current) ensureVisible();
    },
    [ensureVisible],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return (
    <KeyboardScrollContext.Provider value={ensureVisible}>
      <ScrollView
        ref={scrollRef}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={{ flexGrow: 1 }}>
        <View ref={contentRef} collapsable={false} style={contentStyle}>
          {children}
        </View>
      </ScrollView>
    </KeyboardScrollContext.Provider>
  );
}
