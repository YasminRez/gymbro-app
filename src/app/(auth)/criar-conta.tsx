import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { TextInputInstance, View } from 'react-native';
import { z } from 'zod';

import { Button, Checkbox, Header, Input, Notice, Screen, Text } from '@/components/ui';
import { AUTH_MESSAGES, AuthError, authApi } from '@/features/auth/api';
import { maskDate, parseBRDate } from '@/domain/masks';
import { isAdult, isStrongPassword, PASSWORD_ERROR } from '@/domain/rules';
import { colors, spacing } from '@/theme';

/** A4 · US-01 — Criar conta (RN-002, RN-003, RN-004, RN-005) */
const schema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.string().trim().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  nascimento: z
    .string()
    .min(1, 'Informe sua data de nascimento.')
    .refine((v) => v.length === 10, 'Complete a data no formato DD/MM/AAAA.')
    .refine((v) => v.length < 10 || parseBRDate(v) !== null, 'Data inválida.')
    .refine((v) => {
      const d = parseBRDate(v);
      return !d || isAdult(d);
    }, AUTH_MESSAGES.underage),
  senha: z.string().min(1, 'Crie uma senha.').refine(isStrongPassword, PASSWORD_ERROR),
  termos: z.literal(true, 'É preciso aceitar os termos para continuar.'),
});

type Form = z.infer<typeof schema>;

export default function CriarConta() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const nascRef = useRef<TextInputInstance>(null);
  const senhaRef = useRef<TextInputInstance>(null);

  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: 'onTouched', // valida ao sair do campo (US-01, cenário 4)
    defaultValues: { nome: '', email: '', nascimento: '', senha: '', termos: false as unknown as true },
  });
  const v = useWatch({ control });
  // Cenário 5: botão desabilitado até tudo estar preenchido
  const filled = !!(v.nome?.trim() && v.email?.trim() && v.nascimento?.length === 10 && v.senha && v.termos);

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      const res = await authApi.signUp({
        nome: data.nome,
        email: data.email,
        nascimento: parseBRDate(data.nascimento)!,
        senha: data.senha,
      });
      if (res.needsEmailConfirmation) {
        setInfo(AUTH_MESSAGES.confirmEmail);
        return;
      }
      // Sessão criada: o layout raiz leva para o perfil (US-04).
    } catch (e) {
      setServerError(e instanceof AuthError ? e.message : AUTH_MESSAGES.generic);
    }
  });

  const err = formState.errors;

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            title="Criar conta"
            onPress={onSubmit}
            disabled={!filled}
            loading={formState.isSubmitting}
          />
          <Text variant="body" color={colors.text.secondary} style={{ textAlign: 'center' }}>
            Já tem conta?{' '}
            <Link href="/entrar" replace>
              <Text variant="body" color={colors.brand.red}>
                Entrar
              </Text>
            </Link>
          </Text>
        </>
      }>
      <Header title="Criar conta" />
      <Text variant="body" color={colors.text.secondary}>
        Leva menos de 1 minuto. Depois você monta seu perfil.
      </Text>

      <Controller
        control={control}
        name="nome"
        render={({ field }) => (
          <Input
            label="Nome"
            icon="person-outline"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.nome?.message}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            ref={emailRef}
            label="E-mail"
            icon="mail-outline"
            value={field.value}
            onChangeText={(t) => {
              setServerError(null);
              field.onChange(t);
            }}
            onBlur={field.onBlur}
            error={
              err.email?.message ?? (serverError === AUTH_MESSAGES.emailExists ? serverError : undefined)
            }
            valid={fieldState.isTouched && !fieldState.invalid && serverError !== AUTH_MESSAGES.emailExists}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => nascRef.current?.focus()}
          />
        )}
      />
      {serverError === AUTH_MESSAGES.emailExists ? (
        <Button
          title="Entrar com este e-mail"
          variant="secondary"
          onPress={() => router.replace('/entrar')}
        />
      ) : null}

      <Controller
        control={control}
        name="nascimento"
        render={({ field }) => (
          <Input
            ref={nascRef}
            label="Data de nascimento"
            icon="calendar-outline"
            placeholder="DD/MM/AAAA"
            value={field.value}
            onChangeText={(t) => field.onChange(maskDate(t))}
            onBlur={field.onBlur}
            error={err.nascimento?.message}
            hint="Você precisa ter 18 anos ou mais."
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="birthdate-full"
            returnKeyType="next"
            onSubmitEditing={() => senhaRef.current?.focus()}
          />
        )}
      />

      <Controller
        control={control}
        name="senha"
        render={({ field }) => (
          <Input
            ref={senhaRef}
            label="Senha"
            icon="lock-closed-outline"
            password
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.senha?.message}
            hint="Mínimo de 8 caracteres, com maiúscula, minúscula, número e símbolo."
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />

      <Controller
        control={control}
        name="termos"
        render={({ field }) => (
          <Checkbox
            checked={!!field.value}
            onChange={field.onChange}
            accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade">
            <Text variant="body" color={colors.text.secondary}>
              Li e aceito os{' '}
              <Link href="/documento/termos-de-uso">
                <Text variant="body" color={colors.brand.red}>
                  Termos de Uso
                </Text>
              </Link>{' '}
              e a{' '}
              <Link href="/documento/politica-de-privacidade">
                <Text variant="body" color={colors.brand.red}>
                  Política de Privacidade
                </Text>
              </Link>
            </Text>
          </Checkbox>
        )}
      />

      <View style={{ gap: spacing.sm }}>
        {serverError && serverError !== AUTH_MESSAGES.emailExists ? (
          <Notice tone="error" icon="alert-circle-outline">
            {serverError}
          </Notice>
        ) : null}
        {info ? (
          <Notice tone="success" icon="mail-outline">
            {info}
          </Notice>
        ) : null}
      </View>
    </Screen>
  );
}
