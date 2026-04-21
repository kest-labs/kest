'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Crown,
  Link2,
  Link2Off,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard, StatCardSkeleton } from '@/components/features/console/dashboard-stats';
import { ActionMenu, type ActionMenuItem } from '@/components/features/project/action-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildApiPath } from '@/config/api';
import { env } from '@/config/env';
import { buildProjectDetailRoute, buildProjectInviteRoute } from '@/constants/routes';
import {
  useCreateProjectMember,
  useDeleteProjectMember,
  useProjectMemberRole,
  useProjectMembers,
  useUpdateProjectMember,
} from '@/hooks/use-members';
import {
  useCreateProjectInvitation,
  useDeleteProjectInvitation,
  useProjectInvitations,
} from '@/hooks/use-project-invitations';
import { useProject, useProjectStats } from '@/hooks/use-projects';
import { useUserSearch } from '@/hooks/use-users';
import type { ApiUser } from '@/types/auth';
import {
  PROJECT_MEMBER_ASSIGNABLE_ROLES,
  canEditProjectMember,
  canManageProjectMembers,
  canRemoveProjectMember,
  getProjectMemberRoleLabel,
  sortProjectMembers,
  type AssignableProjectMemberRole,
  type ProjectMember,
  type ProjectMemberRole,
} from '@/types/member';
import {
  PROJECT_INVITATION_ASSIGNABLE_ROLES,
  getProjectInvitationRemainingUsesLabel,
  getProjectInvitationStatusLabel,
  type ProjectInvitation,
  type ProjectInvitationRole,
  type ProjectInvitationStatus,
} from '@/types/project-invitation';
import { formatDate } from '@/utils';

const EMPTY_MEMBERS: ProjectMember[] = [];
const EMPTY_INVITATIONS: ProjectInvitation[] = [];
const configuredInviteBaseUrl = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ?? '';

const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
};

const resolveBrowserInviteBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  if (isLoopbackHostname(window.location.hostname)) {
    return '';
  }

  return window.location.origin.replace(/\/+$/, '');
};
const ROLE_FILTER_OPTIONS: Array<{ value: 'all' | ProjectMemberRole; label: string }> = [
  { value: 'all', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'write', label: 'Write' },
  { value: 'read', label: 'Read' },
];

const createDefaultInviteExpiryInput = () => {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const getRoleBadgeVariant = (role: ProjectMemberRole) => {
  if (role === 'owner') {
    return 'default';
  }

  if (role === 'admin') {
    return 'secondary';
  }

  return 'outline';
};

const getMemberInitials = (member: Pick<ProjectMember, 'username' | 'email'>) => {
  const source = member.username.trim() || member.email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

const getAssignableRole = (role?: ProjectMemberRole): AssignableProjectMemberRole => {
  if (role === 'admin' || role === 'write' || role === 'read') {
    return role;
  }

  return 'read';
};

const getInvitationStatusBadgeClassName = (status?: ProjectInvitationStatus) => {
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

function RoleBadge({ role }: { role?: ProjectMemberRole }) {
  return (
    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
      Role: {getProjectMemberRoleLabel(role)}
    </Badge>
  );
}

function MembersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl border bg-muted/40" />
      ))}
    </div>
  );
}

export function ProjectMemberManagementPage({ projectId }: { projectId: number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ProjectMemberRole>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<ApiUser | null>(null);
  const [newMemberRole, setNewMemberRole] = useState<AssignableProjectMemberRole>('read');
  const [addDialogError, setAddDialogError] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [editingRole, setEditingRole] = useState<AssignableProjectMemberRole>('read');
  const [deleteTarget, setDeleteTarget] = useState<ProjectMember | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<ProjectInvitationRole>('read');
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [inviteExpiresAt, setInviteExpiresAt] = useState(createDefaultInviteExpiryInput());
  const [inviteDialogError, setInviteDialogError] = useState<string | null>(null);
  const [generatedInvitation, setGeneratedInvitation] = useState<ProjectInvitation | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ProjectInvitation | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());

  const projectQuery = useProject(projectId);
  const projectStatsQuery = useProjectStats(projectId);
  const membersQuery = useProjectMembers(projectId);
  const memberRoleQuery = useProjectMemberRole(projectId);
  const userSearchQuery = useUserSearch(deferredCandidateQuery, 20);
  const createMemberMutation = useCreateProjectMember(projectId);
  const updateMemberMutation = useUpdateProjectMember(projectId);
  const deleteMemberMutation = useDeleteProjectMember(projectId);
  const invitationsQuery = useProjectInvitations(
    projectId,
    canManageProjectMembers(memberRoleQuery.data?.role)
  );
  const createInvitationMutation = useCreateProjectInvitation(projectId);
  const deleteInvitationMutation = useDeleteProjectInvitation(projectId);

  const project = projectQuery.data;
  const currentRole = memberRoleQuery.data?.role;
  const currentUserId = memberRoleQuery.data?.user_id;
  const canManageMembers = canManageProjectMembers(currentRole);
  const members = useMemo(
    () => sortProjectMembers(membersQuery.data ?? EMPTY_MEMBERS),
    [membersQuery.data]
  );
  const memberUserIds = useMemo(() => new Set(members.map(member => member.user_id)), [members]);
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesKeyword =
        !deferredSearchQuery ||
        member.username.toLowerCase().includes(deferredSearchQuery) ||
        member.email.toLowerCase().includes(deferredSearchQuery);

      return matchesRole && matchesKeyword;
    });
  }, [deferredSearchQuery, members, roleFilter]);
  const candidateResults = useMemo(
    () => (userSearchQuery.data ?? []).filter(candidate => !memberUserIds.has(candidate.id)),
    [memberUserIds, userSearchQuery.data]
  );
  const ownerCount = members.filter(member => member.role === 'owner').length;
  const adminCount = members.filter(member => member.role === 'admin').length;
  const writeCount = members.filter(member => member.role === 'write').length;
  const readCount = members.filter(member => member.role === 'read').length;
  const invitations = invitationsQuery.data ?? EMPTY_INVITATIONS;
  const membersPath = buildApiPath('/projects/:id/members');
  const membersMePath = buildApiPath('/projects/:id/members/me');
  const invitationsPath = buildApiPath('/projects/:id/invitations');
  const isRefreshing =
    projectQuery.isFetching ||
    projectStatsQuery.isFetching ||
    membersQuery.isFetching ||
    memberRoleQuery.isFetching ||
    invitationsQuery.isFetching;
  const hasLoadError =
    !membersQuery.isLoading && (Boolean(membersQuery.error) || Boolean(memberRoleQuery.error));
  const hasInvitationLoadError =
    canManageMembers && !invitationsQuery.isLoading && Boolean(invitationsQuery.error);

  const resetAddDialog = () => {
    setCandidateQuery('');
    setSelectedCandidate(null);
    setNewMemberRole('read');
    setAddDialogError(null);
  };

  const resetInviteDialog = () => {
    setInviteRole('read');
    setInviteMaxUses('1');
    setInviteExpiresAt(createDefaultInviteExpiryInput());
    setInviteDialogError(null);
    setGeneratedInvitation(null);
  };

  const handleRefresh = async () => {
    const tasks: Array<Promise<unknown>> = [
      projectQuery.refetch(),
      projectStatsQuery.refetch(),
      membersQuery.refetch(),
      memberRoleQuery.refetch(),
    ];

    if (canManageMembers) {
      tasks.push(invitationsQuery.refetch());
    }

    await Promise.all(tasks);
  };

  const handleOpenAddDialog = () => {
    resetAddDialog();
    setIsAddDialogOpen(true);
  };

  const handleOpenInviteDialog = () => {
    resetInviteDialog();
    setIsInviteDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedCandidate) {
      setAddDialogError('Select a user before adding a member.');
      return;
    }

    try {
      await createMemberMutation.mutateAsync({
        user_id: selectedCandidate.id,
        role: newMemberRole,
      });
      setIsAddDialogOpen(false);
      resetAddDialog();
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const resolveInviteLink = (invitation: ProjectInvitation) => {
    const invitePath = buildProjectInviteRoute(invitation.slug);

    if (configuredInviteBaseUrl) {
      return `${configuredInviteBaseUrl}${invitePath}`;
    }

    const browserInviteBaseUrl = resolveBrowserInviteBaseUrl();
    if (browserInviteBaseUrl) {
      return `${browserInviteBaseUrl}${invitePath}`;
    }

    try {
      if (!invitation.invite_url) {
        throw new Error('missing invite_url');
      }

      const fallbackBaseUrl =
        typeof window !== 'undefined' ? window.location.origin : 'https://kest.run';
      const resolvedInviteUrl = new URL(invitation.invite_url, fallbackBaseUrl);
      if (isLoopbackHostname(resolvedInviteUrl.hostname)) {
        return invitePath;
      }
      return resolvedInviteUrl.toString();
    } catch {
      return invitePath;
    }
  };

  const copyInviteLink = async (invitation: ProjectInvitation) => {
    try {
      await navigator.clipboard.writeText(resolveInviteLink(invitation));
      toast.success('Invite link copied to clipboard');
    } catch {
      toast.error('Failed to copy invite link');
    }
  };

  const handleCreateInvitation = async () => {
    const trimmedMaxUses = inviteMaxUses.trim();
    let parsedMaxUses: number | undefined;

    if (trimmedMaxUses !== '') {
      parsedMaxUses = Number.parseInt(trimmedMaxUses, 10);
      if (Number.isNaN(parsedMaxUses) || parsedMaxUses < 0) {
        setInviteDialogError('Max uses must be 0 or a positive integer.');
        return;
      }
    }

    let expiresAt: string | undefined;
    if (inviteExpiresAt.trim()) {
      const parsedDate = new Date(inviteExpiresAt);
      if (Number.isNaN(parsedDate.getTime())) {
        setInviteDialogError('Select a valid expiration date.');
        return;
      }
      expiresAt = parsedDate.toISOString();
    }

    try {
      const invitation = await createInvitationMutation.mutateAsync({
        role: inviteRole,
        max_uses: parsedMaxUses,
        expires_at: expiresAt,
      });
      setGeneratedInvitation(invitation);
      setInviteDialogError(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleOpenEditDialog = (member: ProjectMember) => {
    setEditingMember(member);
    setEditingRole(getAssignableRole(member.role));
  };

  const handleUpdateMember = async () => {
    if (!editingMember) {
      return;
    }

    try {
      await updateMemberMutation.mutateAsync({
        userId: editingMember.user_id,
        data: {
          role: editingRole,
        },
      });
      setEditingMember(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteMemberMutation.mutateAsync(deleteTarget.user_id);
      setDeleteTarget(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const handleRevokeInvitation = async () => {
    if (!revokeTarget) {
      return;
    }

    try {
      await deleteInvitationMutation.mutateAsync(revokeTarget.id);
      setRevokeTarget(null);
    } catch {
      // Global HTTP error handling already surfaces failure feedback.
    }
  };

  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'members-refresh',
      label: isRefreshing ? 'Refreshing...' : 'Refresh',
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'members-add',
      label: 'Add Member',
      icon: UserPlus,
      disabled: !canManageMembers,
      onSelect: handleOpenAddDialog,
    },
  ];

  return (
    <>
      <main className="min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto">
        <div className="space-y-8 p-6 pt-6">
          <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-linear-to-r from-primary/10 via-cyan-500/5 to-transparent p-6 transition-colors duration-500">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0xOCAxOGgyNHYyNEgxOHoiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-50" />
            <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <Button
                  asChild
                  variant="link"
                  className="h-auto px-0 text-sm text-muted-foreground"
                >
                  <Link href={buildProjectDetailRoute(projectId)}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Project Overview
                  </Link>
                </Button>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Members</h1>
                    <Users className="h-6 w-6 text-primary" />
                    <RoleBadge role={currentRole} />
                  </div>
                  <p className="max-w-4xl text-sm text-text-muted">
                    Manage project access through <code>{membersPath}</code> and resolve the current
                    user role through <code>{membersMePath}</code>.
                  </p>
                </div>

                {project ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {project.slug}
                    </Badge>
                    <Badge variant="outline">{project.name}</Badge>
                    <Badge variant="outline">
                      {projectStatsQuery.data?.member_count ?? members.length} members
                    </Badge>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={handleOpenInviteDialog} disabled={!canManageMembers}>
                  <Link2 className="h-4 w-4" />
                  Generate Invite Link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenAddDialog}
                  disabled={!canManageMembers}
                >
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </Button>
                <ActionMenu
                  items={headerActionItems}
                  ariaLabel="Open member management actions"
                  triggerVariant="outline"
                />
              </div>
            </div>
          </div>

          {!canManageMembers && memberRoleQuery.isSuccess ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Read-only member access</AlertTitle>
              <AlertDescription>
                当前角色是 <strong>{getProjectMemberRoleLabel(currentRole)}</strong>
                ，可以查看成员列表，但只有 <strong>admin</strong> 和 <strong>owner</strong>{' '}
                可以新增、调整或移除成员。
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {membersQuery.isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Total Members"
                  value={projectStatsQuery.data?.member_count ?? members.length}
                  description="All users with project access"
                  icon={Users}
                />
                <StatCard
                  title="Admins & Owners"
                  value={ownerCount + adminCount}
                  description={`${ownerCount} owner${ownerCount === 1 ? '' : 's'}, ${adminCount} admin${adminCount === 1 ? '' : 's'}`}
                  icon={ShieldCheck}
                  variant="warning"
                />
                <StatCard
                  title="Writers"
                  value={writeCount}
                  description="Can edit project resources"
                  icon={Pencil}
                  variant="success"
                />
                <StatCard
                  title="Readers"
                  value={readCount}
                  description="Browse-only project access"
                  icon={Mail}
                  variant="default"
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>Invite Links</CardTitle>
                  <CardDescription>
                    Generate role-scoped invite links through <code>{invitationsPath}</code> and
                    manage their lifecycle before sharing externally.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenInviteDialog}
                  disabled={!canManageMembers}
                >
                  <Link2 className="h-4 w-4" />
                  New Invite Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!canManageMembers && memberRoleQuery.isSuccess ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Invite management requires admin access</AlertTitle>
                  <AlertDescription>
                    Invite links can be listed, generated, copied, and revoked only by{' '}
                    <strong>admin</strong> or <strong>owner</strong> members.
                  </AlertDescription>
                </Alert>
              ) : invitationsQuery.isLoading ? (
                <MembersTableSkeleton />
              ) : hasInvitationLoadError ? (
                <Alert>
                  <AlertTitle>Unable to load invite links</AlertTitle>
                  <AlertDescription>
                    Refresh the page or confirm the current user still has permission to manage
                    invitations for this project.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map(invitation => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="outline">
                                {getProjectMemberRoleLabel(invitation.role)}
                              </Badge>
                              <div className="font-mono text-xs text-muted-foreground">
                                {invitation.token_prefix}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getInvitationStatusBadgeClassName(invitation.status)}
                            >
                              {getProjectInvitationStatusLabel(invitation.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getProjectInvitationRemainingUsesLabel(invitation)}
                          </TableCell>
                          <TableCell>{invitation.used_count}</TableCell>
                          <TableCell>
                            {invitation.expires_at
                              ? formatDate(invitation.expires_at, 'YYYY-MM-DD HH:mm')
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            {formatDate(invitation.created_at, 'YYYY-MM-DD HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  void copyInviteLink(invitation);
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={invitation.status === 'revoked'}
                                onClick={() => setRevokeTarget(invitation)}
                              >
                                <Link2Off className="h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {invitations.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-10 text-center text-muted-foreground"
                          >
                            No invite links have been generated for this project yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>Project Members</CardTitle>
                  <CardDescription>
                    Search by username or email, then adjust operational roles for non-owner
                    members.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      placeholder="Filter by username or email"
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={roleFilter}
                    onValueChange={value => setRoleFilter(value as 'all' | ProjectMemberRole)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_FILTER_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {membersQuery.isLoading ? (
                <MembersTableSkeleton />
              ) : hasLoadError ? (
                <Alert>
                  <AlertTitle>Unable to load members</AlertTitle>
                  <AlertDescription>
                    The project members page could not load its data. Retry the request or confirm
                    the current user still has access to this project.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(member => {
                        const isCurrentUser =
                          currentUserId !== undefined && member.user_id === currentUserId;
                        const canEdit = canEditProjectMember(member, currentRole, currentUserId);
                        const canRemove = canRemoveProjectMember(
                          member,
                          currentRole,
                          currentUserId
                        );
                        const rowActionItems: ActionMenuItem[] = [
                          {
                            key: `edit-${member.user_id}`,
                            label: 'Edit Role',
                            icon: Pencil,
                            disabled: !canEdit,
                            onSelect: () => handleOpenEditDialog(member),
                          },
                          {
                            key: `delete-${member.user_id}`,
                            label: 'Remove',
                            icon: Trash2,
                            destructive: true,
                            separatorBefore: true,
                            disabled: !canRemove,
                            onSelect: () => setDeleteTarget(member),
                          },
                        ];

                        return (
                          <TableRow key={member.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>{getMemberInitials(member)}</AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{member.username}</span>
                                    {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                                    {member.role === 'owner' ? (
                                      <Badge variant="outline" className="gap-1">
                                        <Crown className="h-3 w-3" />
                                        Owner
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>{member.email}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(member.role)}>
                                {getProjectMemberRoleLabel(member.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatDate(member.created_at, 'YYYY-MM-DD HH:mm')}
                            </TableCell>
                            <TableCell>
                              {formatDate(member.updated_at, 'YYYY-MM-DD HH:mm')}
                            </TableCell>
                            <TableCell className="text-right">
                              {!canManageMembers ? (
                                <span className="text-sm text-muted-foreground">
                                  Admin required
                                </span>
                              ) : canEdit || canRemove ? (
                                <ActionMenu
                                  items={rowActionItems}
                                  ariaLabel={`Open actions for ${member.username}`}
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground">Protected</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-10 text-center text-muted-foreground"
                          >
                            No members match the current filter.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog
        open={isInviteDialogOpen}
        onOpenChange={open => {
          setIsInviteDialogOpen(open);
          if (!open) {
            resetInviteDialog();
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Generate Invite Link</DialogTitle>
            <DialogDescription>
              Create a shareable project invite that grants a predefined role after the invited user
              logs in.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-5">
              {inviteDialogError ? (
                <Alert variant="destructive">
                  <AlertTitle>Cannot generate invite link</AlertTitle>
                  <AlertDescription>{inviteDialogError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={value => {
                      setInviteRole(value as ProjectInvitationRole);
                      setInviteDialogError(null);
                    }}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_INVITATION_ASSIGNABLE_ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          {getProjectMemberRoleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-max-uses">Max uses</Label>
                  <Input
                    id="invite-max-uses"
                    type="number"
                    min="0"
                    value={inviteMaxUses}
                    onChange={event => {
                      setInviteMaxUses(event.target.value);
                      setInviteDialogError(null);
                    }}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use <strong>0</strong> for an unlimited link. Default is <strong>1</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-expires-at">Expires at</Label>
                <Input
                  id="invite-expires-at"
                  type="datetime-local"
                  value={inviteExpiresAt}
                  onChange={event => {
                    setInviteExpiresAt(event.target.value);
                    setInviteDialogError(null);
                  }}
                />
              </div>

              {generatedInvitation ? (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Invite link generated</div>
                      <div className="break-all text-sm text-muted-foreground">
                        {resolveInviteLink(generatedInvitation)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void copyInviteLink(generatedInvitation);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleCreateInvitation();
              }}
              disabled={createInvitationMutation.isPending || !canManageMembers}
            >
              <Link2 className="h-4 w-4" />
              Generate Invite Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={open => {
          setIsAddDialogOpen(open);
          if (!open) {
            resetAddDialog();
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>
              Search existing users, then grant them project access with an assignable role.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-5">
              {addDialogError ? (
                <Alert variant="destructive">
                  <AlertTitle>Cannot add member</AlertTitle>
                  <AlertDescription>{addDialogError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="member-search">Find user</Label>
                <Input
                  id="member-search"
                  value={candidateQuery}
                  onChange={event => {
                    setCandidateQuery(event.target.value);
                    setAddDialogError(null);
                  }}
                  placeholder="Search by username or email"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Matching users</Label>
                  <span className="text-sm text-muted-foreground">
                    {userSearchQuery.isFetching
                      ? 'Searching…'
                      : `${candidateResults.length} available`}
                  </span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                  {deferredCandidateQuery.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Start typing to search existing users.
                    </p>
                  ) : userSearchQuery.isFetching ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-xl bg-muted/50" />
                      ))}
                    </div>
                  ) : candidateResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No eligible users matched this query. Matching users who are already project
                      members are hidden.
                    </p>
                  ) : (
                    candidateResults.map(candidate => {
                      const isSelected = selectedCandidate?.id === candidate.id;

                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setAddDialogError(null);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{candidate.username}</div>
                            <div className="truncate text-sm text-muted-foreground">
                              {candidate.email}
                            </div>
                          </div>
                          {isSelected ? (
                            <Badge>Selected</Badge>
                          ) : (
                            <Badge variant="outline">Select</Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-role">Role</Label>
                <Select
                  value={newMemberRole}
                  onValueChange={value => setNewMemberRole(value as AssignableProjectMemberRole)}
                >
                  <SelectTrigger id="member-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ASSIGNABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {getProjectMemberRoleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCandidate ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-sm font-medium">Selected user</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedCandidate.username} · {selectedCandidate.email}
                  </div>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleAddMember();
              }}
              disabled={createMemberMutation.isPending || !canManageMembers}
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingMember)} onOpenChange={open => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Role</DialogTitle>
            <DialogDescription>
              Update the project role for <strong>{editingMember?.username}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <div className="font-medium">{editingMember?.username}</div>
                <div className="text-sm text-muted-foreground">{editingMember?.email}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-role">Role</Label>
                <Select
                  value={editingRole}
                  onValueChange={value => setEditingRole(value as AssignableProjectMemberRole)}
                >
                  <SelectTrigger id="edit-member-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ASSIGNABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {getProjectMemberRoleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleUpdateMember();
              }}
              disabled={updateMemberMutation.isPending || !editingMember}
            >
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleteTarget?.username}</strong> from this project.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Alert>
              <AlertTitle>Access will be revoked immediately</AlertTitle>
              <AlertDescription>
                {deleteTarget?.username} will no longer be able to access project resources after
                this action completes.
              </AlertDescription>
            </Alert>
            {deleteTarget ? (
              <div className="mt-4 rounded-xl border p-4">
                <div className="font-medium">{deleteTarget.username}</div>
                <div className="text-sm text-muted-foreground">{deleteTarget.email}</div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteMember();
              }}
              disabled={deleteMemberMutation.isPending || !deleteTarget}
            >
              <Trash2 className="h-4 w-4" />
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeTarget)} onOpenChange={open => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Invite Link</DialogTitle>
            <DialogDescription>
              Revoke the selected invite link immediately. Existing members keep their access, but
              the link can no longer be accepted.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Alert>
              <AlertTitle>Link access will be disabled immediately</AlertTitle>
              <AlertDescription>
                {revokeTarget ? resolveInviteLink(revokeTarget) : ''}
              </AlertDescription>
            </Alert>
            {revokeTarget ? (
              <div className="mt-4 rounded-xl border p-4">
                <div className="font-medium">
                  {getProjectMemberRoleLabel(revokeTarget.role)} invitation
                </div>
                <div className="text-sm text-muted-foreground">
                  {getProjectInvitationStatusLabel(revokeTarget.status)} ·{' '}
                  {revokeTarget.max_uses === 0
                    ? 'Unlimited uses'
                    : `${revokeTarget.max_uses} max uses`}
                </div>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleRevokeInvitation();
              }}
              disabled={deleteInvitationMutation.isPending || !revokeTarget}
            >
              <Link2Off className="h-4 w-4" />
              Revoke Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
