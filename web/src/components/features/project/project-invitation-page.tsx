'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, LogIn, MailPlus, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES, buildProjectCategoriesRoute, buildProjectInviteRoute } from '@/constants/routes';
import {
  useAcceptProjectInvitation,
  useProjectInvitationDetail,
  useRejectProjectInvitation,
} from '@/hooks/use-project-invitations';
import { useT } from '@/i18n/client';
import { useAuthStore } from '@/store/auth-store';
import { isProjectInvitationActive } from '@/types/project-invitation';
import { formatDate } from '@/utils';

const getStatusBadgeClassName = (status?: string) => {
  switch (status) {
    case 'active':
      return 'border-border-strong bg-[var(--miro-surface-yellow)] text-[var(--miro-yellow-dark)]';
    case 'rejected':
      return 'border-border-subtle bg-bg-subtle text-text-main';
    case 'used_up':
      return 'border-border-subtle bg-bg-surface text-text-main';
    case 'revoked':
      return 'border-border-subtle bg-bg-surface text-text-main';
    case 'expired':
      return 'border-border-subtle bg-bg-subtle text-text-main';
    default:
      return 'border-border-subtle bg-bg-subtle text-text-muted';
  }
};

export function ProjectInvitationPage({ slug }: { slug: string }) {
  const t = useT('project');
  const router = useRouter();
  const [wasRejected, setWasRejected] = useState(false);

  const isAuthenticated = useAuthStore.use.isAuthenticated();
  const isLoadingAuth = useAuthStore.use.isLoading();
  const isSystemReady = useAuthStore.use.isSystemReady();

  const invitationQuery = useProjectInvitationDetail(slug);
  const acceptInvitationMutation = useAcceptProjectInvitation(slug);
  const rejectInvitationMutation = useRejectProjectInvitation(slug);

  const invitation = invitationQuery.data;
  const inviteRoute = buildProjectInviteRoute(slug);
  const loginHref = `${ROUTES.AUTH.LOGIN}?returnUrl=${encodeURIComponent(inviteRoute)}`;
  const registerHref = `${ROUTES.AUTH.REGISTER}?returnUrl=${encodeURIComponent(inviteRoute)}`;
  const canRespond = isAuthenticated && isProjectInvitationActive(invitation) && !wasRejected;

  const handleAcceptInvitation = async () => {
    try {
      const result = await acceptInvitationMutation.mutateAsync(undefined);
      router.replace(result.redirect_to || buildProjectCategoriesRoute(result.project_id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRejectInvitation = async () => {
    try {
      await rejectInvitationMutation.mutateAsync(undefined);
      setWasRejected(true);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'owner':
        return t('roles.owner');
      case 'admin':
        return t('roles.admin');
      case 'write':
        return t('roles.write');
      case 'read':
        return t('roles.read');
      default:
        return t('roles.unknown');
    }
  };

  const getInvitationStatusLabel = (status?: string) => {
    switch (status) {
      case 'active':
        return t('invitation.statusActive');
      case 'expired':
        return t('invitation.statusExpired');
      case 'rejected':
        return t('invitation.statusRejected');
      case 'revoked':
        return t('invitation.statusRevoked');
      case 'used_up':
        return t('invitation.statusUsedUp');
      default:
        return t('roles.unknown');
    }
  };

  return (
    <main className="min-h-screen bg-bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="overflow-hidden rounded-xl border-border-subtle bg-bg-canvas">
          <CardHeader className="gap-4 border-b border-border-subtle bg-bg-surface">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={getStatusBadgeClassName(invitation?.status)}>
                {getInvitationStatusLabel(invitation?.status)}
              </Badge>
              <Badge variant="outline" className="gap-1 border-border-strong bg-bg-canvas">
                <ShieldCheck className="h-3.5 w-3.5" />
                {getRoleLabel(invitation?.role)}
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="figma-headline">{t('invitation.title')}</CardTitle>
              <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                {t('invitation.description')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {invitationQuery.isLoading || (!isSystemReady && isLoadingAuth) ? (
              <div className="space-y-4">
                <div className="h-6 w-48 animate-pulse rounded bg-bg-subtle" />
                <div className="h-24 animate-pulse rounded-md bg-bg-soft" />
                <div className="grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-md bg-bg-soft" />
                  ))}
                </div>
              </div>
            ) : invitationQuery.isError || !invitation ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{t('invitation.unavailableTitle')}</AlertTitle>
                <AlertDescription>{t('invitation.unavailableDescription')}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1">
                      <p className="figma-caption text-muted-foreground">
                        {t('invitation.projectLabel')}
                      </p>
                      <h1 className="text-2xl font-medium tracking-normal">
                        {invitation.project_name}
                      </h1>
                      <p className="font-mono text-sm text-muted-foreground">
                        {invitation.project_slug}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('invitation.invitationPath')}: <code>{inviteRoute}</code>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      {t('invitation.roleLabel')}
                    </div>
                    <p className="mt-3 text-lg font-medium">{getRoleLabel(invitation.role)}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      {t('invitation.expiresLabel')}
                    </div>
                    <p className="mt-3 text-lg font-medium">
                      {invitation.expires_at
                        ? formatDate(invitation.expires_at, 'YYYY-MM-DD HH:mm')
                        : t('invitation.never')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-bg-canvas p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MailPlus className="h-4 w-4" />
                      {t('invitation.remainingUsesLabel')}
                    </div>
                    <p className="mt-3 text-lg font-medium">
                      {invitation.remaining_uses === null
                        ? t('invitation.unlimited')
                        : invitation.remaining_uses}
                    </p>
                  </div>
                </div>

                {!isAuthenticated && isSystemReady ? (
                  <Alert>
                    <LogIn className="h-4 w-4" />
                    <AlertTitle>{t('invitation.loginRequiredTitle')}</AlertTitle>
                    <AlertDescription>{t('invitation.loginRequiredDescription')}</AlertDescription>
                  </Alert>
                ) : null}

                {wasRejected ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>{t('invitation.rejectedTitle')}</AlertTitle>
                    <AlertDescription>{t('invitation.rejectedDescription')}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {!isAuthenticated ? (
                    <>
                      <Button asChild size="lg">
                        <Link href={loginHref}>
                          <LogIn className="h-4 w-4" />
                          {t('invitation.loginToContinue')}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg">
                        <Link href={registerHref}>{t('invitation.createAccount')}</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => {
                          void handleAcceptInvitation();
                        }}
                        disabled={!canRespond || acceptInvitationMutation.isPending}
                      >
                        {t('invitation.accept')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          void handleRejectInvitation();
                        }}
                        disabled={!canRespond || rejectInvitationMutation.isPending}
                      >
                        {t('invitation.reject')}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
