'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock3,
  LogIn,
  MailPlus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES, buildProjectDetailRoute, buildProjectInviteRoute } from '@/constants/routes';
import {
  useAcceptProjectInvitation,
  useProjectInvitationDetail,
  useRejectProjectInvitation,
} from '@/hooks/use-project-invitations';
import { useAuthStore } from '@/store/auth-store';
import { getProjectMemberRoleLabel } from '@/types/member';
import {
  getProjectInvitationStatusLabel,
  isProjectInvitationActive,
} from '@/types/project-invitation';
import { formatDate } from '@/utils';

const getStatusBadgeClassName = (status?: string) => {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'used_up':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'revoked':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'expired':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
};

export function ProjectInvitationPage({ slug }: { slug: string }) {
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
      const result = await acceptInvitationMutation.mutateAsync();
      router.replace(result.redirect_to || buildProjectDetailRoute(result.project_id));
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRejectInvitation = async () => {
    try {
      await rejectInvitationMutation.mutateAsync();
      setWasRejected(true);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-primary/10 via-background to-background px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Card className="overflow-hidden border-primary/15">
          <CardHeader className="gap-4 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={getStatusBadgeClassName(invitation?.status)}>
                {getProjectInvitationStatusLabel(invitation?.status)}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {getProjectMemberRoleLabel(invitation?.role)}
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">Project Invitation</CardTitle>
              <CardDescription className="max-w-2xl text-sm text-muted-foreground">
                Review the invitation details, then accept the requested role to join the project.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {invitationQuery.isLoading || (!isSystemReady && isLoadingAuth) ? (
              <div className="space-y-4">
                <div className="h-6 w-48 animate-pulse rounded bg-muted/60" />
                <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
                <div className="grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/50" />
                  ))}
                </div>
              </div>
            ) : invitationQuery.isError || !invitation ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Invitation unavailable</AlertTitle>
                <AlertDescription>
                  This invite link could not be loaded. It may have been revoked, deleted, or
                  malformed.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Project</p>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        {invitation.project_name}
                      </h1>
                      <p className="font-mono text-sm text-muted-foreground">
                        {invitation.project_slug}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Invitation path: <code>{inviteRoute}</code>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Role
                    </div>
                    <p className="mt-3 text-lg font-semibold">
                      {getProjectMemberRoleLabel(invitation.role)}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      Expires
                    </div>
                    <p className="mt-3 text-lg font-semibold">
                      {invitation.expires_at
                        ? formatDate(invitation.expires_at, 'YYYY-MM-DD HH:mm')
                        : 'Never'}
                    </p>
                  </div>
                  <div className="rounded-2xl border p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MailPlus className="h-4 w-4" />
                      Remaining uses
                    </div>
                    <p className="mt-3 text-lg font-semibold">
                      {invitation.remaining_uses === null ? 'Unlimited' : invitation.remaining_uses}
                    </p>
                  </div>
                </div>

                {!isAuthenticated && isSystemReady ? (
                  <Alert>
                    <LogIn className="h-4 w-4" />
                    <AlertTitle>Login required</AlertTitle>
                    <AlertDescription>
                      Sign in or create an account first, then return here to accept or reject this
                      invitation.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {wasRejected ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Invitation rejected</AlertTitle>
                    <AlertDescription>
                      You declined this invite. You can keep the page open for reference, but the
                      link has not been accepted.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {!isAuthenticated ? (
                    <>
                      <Button asChild size="lg">
                        <Link href={loginHref}>
                          <LogIn className="h-4 w-4" />
                          Login to Continue
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg">
                        <Link href={registerHref}>Create Account</Link>
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
                        Accept Invitation
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
                        Reject Invitation
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
