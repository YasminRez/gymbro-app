import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewInstance,
  StyleProp,
  TextInput,
  View,
  ViewInstance,
  ViewStyle,
} from 'react-native';

/**
 * Teclado sem tampar campos (RNF-008/RNF-011).
 *
 * No Android o app é edge-to-edge: a janela não encolhe quando o teclado abre,
 * então as telas usam KeyboardAvoidingView com behavior="padding" nas duas
 * plataformas (recomendação do guia de teclado do Expo). Isso encolhe a área
 * visível; este ScrollView rola até o campo focado, com folga, quando o teclado
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
