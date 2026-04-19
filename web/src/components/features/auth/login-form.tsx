'use client';

import Link from 'next/link';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authConfig } from '@/config/auth';
import { useLogin } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loginMutation = useLogin();
  const returnUrl = searchParams.get('returnUrl');
  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const result = await loginMutation.mutateAsync(form);
      const displayName = result.user.nickname || result.user.username || result.user.email;
      // 如果是从受保护页面跳转到登录页，登录成功后回到原始页面；
      // 否则默认进入控制台首页。
      const nextPath = returnUrl || authConfig.routes.afterLogin;

      toast.success(t.auth('loginSuccess'), {
        description: t.auth('welcomeBackUser', { name: displayName }),
      });

      router.replace(nextPath);
    } catch {
      // Error toast is handled by the global HTTP error handler.
    }
  };

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="space-y-1 px-0">
        <CardTitle className="text-2xl font-bold tracking-tight">{t.auth('welcomeBack')}</CardTitle>
        <CardDescription>{t.auth('signInToContinue')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">{t.auth('usernameOrEmail')}</Label>
            <Input
              id="username"
              value={form.username}
              onChange={event => setForm(current => ({ ...current, username: event.target.value }))}
              placeholder={t.auth('enterUsernameOrEmail')}
              autoComplete="username"
              required
              className="bg-bg-canvas"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.auth('password')}</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary transition-colors hover:text-primary-deep hover:underline"
              >
                {t.auth('forgotPassword')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              placeholder={t.auth('enterPassword')}
              autoComplete="current-password"
              required
              className="bg-bg-canvas"
            />
          </div>
          <Button type="submit" className="w-full font-semibold" disabled={loginMutation.isPending}>
            {t.auth('login')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-0 text-sm text-muted-foreground">
        {t.auth('noAccount')}
        <Link
          href={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}
          className="font-medium text-primary transition-colors hover:text-primary-deep hover:underline"
        >
          {t.auth('signUp')}
        </Link>
      </CardFooter>
    </Card>
  );
}
