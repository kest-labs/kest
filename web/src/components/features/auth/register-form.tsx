'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authConfig } from '@/config/auth';
import { useLogin, useRegister } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';
import {
  clearAuthFormDraft,
  readAuthFormDraft,
  REGISTER_FORM_DRAFT_KEY,
  writeAuthFormDraft,
} from './auth-form-draft';

const emptyRegisterForm = {
  username: '',
  email: '',
  nickname: '',
  phone: '',
  password: '',
  confirmPassword: '',
  agreedToTerms: false,
};

export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerMutation = useRegister();
  const loginMutation = useLogin();
  const returnUrl = searchParams.get('returnUrl');
  const [form, setForm] = useState(emptyRegisterForm);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      setForm(readAuthFormDraft(window.sessionStorage, REGISTER_FORM_DRAFT_KEY, emptyRegisterForm));
      setHasHydratedDraft(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedDraft) {
      return;
    }

    writeAuthFormDraft(window.sessionStorage, REGISTER_FORM_DRAFT_KEY, form);
  }, [form, hasHydratedDraft]);

  const persistCurrentForm = useCallback(() => {
    writeAuthFormDraft(window.sessionStorage, REGISTER_FORM_DRAFT_KEY, {
      username: usernameInputRef.current?.value ?? form.username,
      email: emailInputRef.current?.value ?? form.email,
      nickname: nicknameInputRef.current?.value ?? form.nickname,
      phone: phoneInputRef.current?.value ?? form.phone,
      password: passwordInputRef.current?.value ?? form.password,
      confirmPassword: confirmPasswordInputRef.current?.value ?? form.confirmPassword,
      agreedToTerms: form.agreedToTerms,
    });
  }, [
    form.agreedToTerms,
    form.confirmPassword,
    form.email,
    form.nickname,
    form.password,
    form.phone,
    form.username,
  ]);

  useEffect(() => {
    window.addEventListener('beforeunload', persistCurrentForm);
    window.addEventListener('pagehide', persistCurrentForm);

    return () => {
      window.removeEventListener('beforeunload', persistCurrentForm);
      window.removeEventListener('pagehide', persistCurrentForm);
    };
  }, [persistCurrentForm]);

  const isPasswordConfirmed = useMemo(
    () => !form.confirmPassword || form.password === form.confirmPassword,
    [form.confirmPassword, form.password]
  );

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error(t.auth('passwordsDoNotMatch'));
      return;
    }

    if (!form.agreedToTerms) {
      toast.error(t.auth('termsRequired'));
      return;
    }

    try {
      await registerMutation.mutateAsync({
        username: form.username.trim(),
        email: form.email.trim(),
        nickname: form.nickname.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });

      // 注册成功后直接登录，和当前项目的控制台访问流程保持一致。
      await loginMutation.mutateAsync({
        username: form.username.trim(),
        password: form.password,
      });

      toast.success(t.auth('registerSuccess'), {
        description: t.auth('accountCreated'),
      });

      clearAuthFormDraft(window.sessionStorage, REGISTER_FORM_DRAFT_KEY);
      router.replace(returnUrl || authConfig.routes.afterLogin);
    } catch {
      // Error toast is handled by the global HTTP error handler.
    }
  };

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="space-y-3 px-0">
        <p className="figma-caption inline-flex w-fit rounded-full bg-[var(--miro-surface-yellow)] px-3 py-1 text-[var(--miro-yellow-dark)]">{t.auth('loginBadge')}</p>
        <CardTitle className="figma-headline text-text-main">
          {t.auth('createAccount')}
        </CardTitle>
        <CardDescription className="text-base leading-7 text-text-subtle">{t.auth('getStarted')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">{t.auth('username')}</Label>
            <Input
              id="username"
              ref={usernameInputRef}
              value={form.username}
              onChange={event => updateField('username', event.target.value)}
              placeholder={t.auth('enterUsername')}
              autoComplete="username"
              required
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth('email')}</Label>
            <Input
              id="email"
              ref={emailInputRef}
              type="email"
              value={form.email}
              onChange={event => updateField('email', event.target.value)}
              placeholder={t.auth('enterEmail')}
              autoComplete="email"
              required
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">{t.auth('nickname')}</Label>
            <Input
              id="nickname"
              ref={nicknameInputRef}
              value={form.nickname}
              onChange={event => updateField('nickname', event.target.value)}
              placeholder={t.auth('enterNickname')}
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t.auth('phone')}</Label>
            <Input
              id="phone"
              ref={phoneInputRef}
              value={form.phone}
              onChange={event => updateField('phone', event.target.value)}
              placeholder={t.auth('enterPhone')}
              autoComplete="tel"
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth('password')}</Label>
            <Input
              id="password"
              ref={passwordInputRef}
              type="password"
              value={form.password}
              onChange={event => updateField('password', event.target.value)}
              autoComplete="new-password"
              required
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t.auth('confirmPassword')}</Label>
            <Input
              id="confirm-password"
              ref={confirmPasswordInputRef}
              type="password"
              value={form.confirmPassword}
              onChange={event => updateField('confirmPassword', event.target.value)}
              autoComplete="new-password"
              required
              className="bg-bg-canvas"
            />
            {!isPasswordConfirmed ? (
              <p className="text-sm text-destructive">{t.auth('passwordsDoNotMatch')}</p>
            ) : null}
          </div>

          <div className="flex items-start space-x-2 rounded-xl border border-border-subtle bg-bg-subtle p-4">
            <Checkbox
              id="terms"
              checked={form.agreedToTerms}
              onCheckedChange={checked => updateField('agreedToTerms', checked === true)}
              required
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-xs font-medium leading-5 text-text-subtle peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t.auth('agreeToTerms')} {t.auth('termsOfService')} {t.auth('and')}{' '}
                {t.auth('privacyPolicy')}
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={registerMutation.isPending || loginMutation.isPending}
          >
            {t.auth('signUp')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="mt-3 flex flex-wrap items-center justify-center gap-1.5 px-0 text-sm text-muted-foreground">
        {t.auth('hasAccount')}
        <Link
          href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          {t.auth('signIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}
