'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequestPasswordReset } from '@/hooks/use-auth';
import { useT } from '@/i18n/client';

export function ForgotPasswordForm() {
  const t = useT();
  const passwordResetMutation = useRequestPasswordReset();
  const [email, setEmail] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      // 当前后端会立即执行重置并返回结果消息，这里直接提示用户即可。
      const result = await passwordResetMutation.mutateAsync({ email: email.trim() });
      toast.success(t.auth('resetPassword'), {
        description: result.message,
      });
    } catch {
      // Error toast is handled by the global HTTP error handler.
    }
  };

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="space-y-3 px-0">
        <p className="figma-caption text-text-muted">{t.auth('loginBadge')}</p>
        <CardTitle className="figma-headline text-text-main">
          {t.auth('resetPassword')}
        </CardTitle>
        <CardDescription className="text-base leading-7 text-text-subtle">
          {t.auth('resetPasswordDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth('email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.auth('enterEmail')}
              autoComplete="email"
              required
              className="bg-bg-canvas"
            />
          </div>

          <Button type="submit" className="w-full" disabled={passwordResetMutation.isPending}>
            {t.auth('sendResetLink')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="mt-3 px-0 text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-text-main underline-offset-4 hover:underline"
        >
          {t.auth('backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}
