'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Crown, Mail, Pencil, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
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
import { useMembers, useProjectMemberRole, useProjectMembers, useUpdateProjectMember, useDeleteProjectMember } from '@/hooks/use-members';
import { useUserSearch } from '@/hooks/use-users';
import { useT } from '@/i18n/client';
import type { ApiUser } from '@/types/auth';
import {
  PROJECT_MEMBER_ASSIGNABLE_ROLES,
  canEditProjectMember,
  canManageProjectMembers,
  canRemoveProjectMember,
  sortProjectMembers,
  type AssignableProjectMemberRole,
  type ProjectMember,
  type ProjectMemberRole,
} from '@/types/member';
import { cn, formatDate } from '@/utils';

const EMPTY_MEMBERS: ProjectMember[] = [];

const getRoleBadgeVariant = (role: ProjectMemberRole) => {
  if (role === 'owner') return 'default';
  if (role === 'admin') return 'secondary';
  return 'outline';
};

const getMemberInitials = (member: Pick<ProjectMember, 'username' | 'email'>) => {
  const source = (member.username ?? '').trim() || (member.email ?? '').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (source || '?').slice(0, 2).toUpperCase();
};

const getAssignableRole = (role?: ProjectMemberRole): AssignableProjectMemberRole => {
  if (role === 'admin' || role === 'write' || role === 'read') return role;
  return 'read';
};

function MembersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-md border border-border-subtle bg-bg-soft" />
      ))}
    </div>
  );
}

export function WorkspaceMemberManagementPage({ workspaceId }: { workspaceId: number | string }) {
  const i18n = useT();
  const t = i18n.project;
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

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());

  const membersQuery = useProjectMembers(workspaceId);
  const memberRoleQuery = useProjectMemberRole(workspaceId);
  const userSearchQuery = useUserSearch(deferredCandidateQuery, 20);
  const updateMemberMutation = useUpdateProjectMember(workspaceId);
  const deleteMemberMutation = useDeleteProjectMember(workspaceId);
  const addMemberMutation = useMembers(workspaceId);

  const currentRole = memberRoleQuery.data?.role;
  const currentUserId = memberRoleQuery.data?.user_id;
  const canManageMembers = canManageProjectMembers(currentRole);
  const members = useMemo(() => sortProjectMembers(membersQuery.data ?? EMPTY_MEMBERS), [membersQuery.data]);
  const memberUserIds = useMemo(() => new Set(members.map(member => member.user_id)), [members]);
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesKeyword =
        !deferredSearchQuery ||
        (member.username ?? '').toLowerCase().includes(deferredSearchQuery) ||
        (member.email ?? '').toLowerCase().includes(deferredSearchQuery);
      return matchesRole && matchesKeyword;
    });
  }, [deferredSearchQuery, members, roleFilter]);
  const candidateResults = useMemo(
    () => (userSearchQuery.data ?? []).filter(candidate => !memberUserIds.has(String(candidate.id)) && !memberUserIds.has(candidate.id as never)),
    [memberUserIds, userSearchQuery.data]
  );
  const ownerCount = members.filter(member => member.role === 'owner').length;
  const adminCount = members.filter(member => member.role === 'admin').length;
  const writeCount = members.filter(member => member.role === 'write').length;
  const readCount = members.filter(member => member.role === 'read').length;
  const roleFilterOptions: Array<{ value: 'all' | ProjectMemberRole; label: string }> = [
    { value: 'all', label: t('membersPage.allRoles') },
    { value: 'owner', label: t('roles.owner') },
    { value: 'admin', label: t('roles.admin') },
    { value: 'write', label: t('roles.write') },
    { value: 'read', label: t('roles.read') },
  ];
  const isRefreshing = membersQuery.isFetching || memberRoleQuery.isFetching;
  const hasLoadError = !membersQuery.isLoading && (Boolean(membersQuery.error) || Boolean(memberRoleQuery.error));

  const resetAddDialog = () => {
    setCandidateQuery('');
    setSelectedCandidate(null);
    setNewMemberRole('read');
    setAddDialogError(null);
  };

  const handleRefresh = async () => {
    await Promise.all([membersQuery.refetch(), memberRoleQuery.refetch()]);
  };

  const handleOpenAddDialog = () => {
    resetAddDialog();
    setIsAddDialogOpen(true);
  };

  const handleAddMember = async () => {
    if (!selectedCandidate) {
      setAddDialogError(t('membersPage.selectUserRequired'));
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        user_id: String(selectedCandidate.id),
        role: newMemberRole,
      });
      setIsAddDialogOpen(false);
      resetAddDialog();
    } catch {
      // handled globally
    }
  };

  const handleOpenEditDialog = (member: ProjectMember) => {
    setEditingMember(member);
    setEditingRole(getAssignableRole(member.role));
  };

  const handleUpdateMember = async () => {
    if (!editingMember) return;
    try {
      await updateMemberMutation.mutateAsync({
        userId: editingMember.user_id,
        data: { role: editingRole },
      });
      setEditingMember(null);
    } catch {
      // handled globally
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMemberMutation.mutateAsync(deleteTarget.user_id);
      setDeleteTarget(null);
    } catch {
      // handled globally
    }
  };

  const headerActionItems: ActionMenuItem[] = [
    {
      key: 'members-refresh',
      label: isRefreshing ? i18n.common('refreshing') : i18n.common('refresh'),
      icon: RefreshCw,
      disabled: isRefreshing,
      onSelect: () => {
        void handleRefresh();
      },
    },
    {
      key: 'members-add',
      label: t('membersPage.addMember'),
      icon: UserPlus,
      disabled: !canManageMembers,
      onSelect: handleOpenAddDialog,
    },
  ];

  return (
    <>
      <main className="min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto">
        <div className="space-y-6 p-4 md:p-5">
          {!canManageMembers && memberRoleQuery.isSuccess ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>{t('membersPage.readOnlyTitle')}</AlertTitle>
              <AlertDescription>
                {t('membersPage.readOnlyDescription', {
                  role:
                    currentRole === 'owner'
                      ? t('roles.owner')
                      : currentRole === 'admin'
                        ? t('roles.admin')
                        : currentRole === 'write'
                          ? t('roles.write')
                          : t('roles.read'),
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex shrink-0 flex-wrap justify-end gap-2 [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:min-h-8 [&_[data-slot=button]]:px-3 [&_[data-slot=button]]:py-1.5 [&_[data-slot=button]]:text-xs [&_[data-slot=button]>svg]:h-3.5 [&_[data-slot=button]>svg]:w-3.5">
            <Button type="button" variant="outline" onClick={handleOpenAddDialog} disabled={!canManageMembers}>
              <UserPlus className="h-4 w-4" />
              {t('membersPage.addMember')}
            </Button>
            <ActionMenu items={headerActionItems} ariaLabel={t('membersPage.openMemberActions')} triggerVariant="outline" />
          </div>

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
                <StatCard title={t('membersPage.totalMembers')} value={members.length} description={t('membersPage.totalMembersDescription')} icon={Users} />
                <StatCard
                  title={t('membersPage.adminsOwners')}
                  value={ownerCount + adminCount}
                  description={t('membersPage.adminsOwnersDescription', { owners: ownerCount, admins: adminCount })}
                  icon={ShieldCheck}
                  variant="warning"
                />
                <StatCard title={t('membersPage.writers')} value={writeCount} description={t('membersPage.writersDescription')} icon={Pencil} variant="success" />
                <StatCard title={t('membersPage.readers')} value={readCount} description={t('membersPage.readersDescription')} icon={Mail} variant="default" />
              </>
            )}
          </div>

          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>{t('membersPage.projectMembers')}</CardTitle>
                  <CardDescription>{t('membersPage.projectMembersDescription')}</CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={t('membersPage.filterPlaceholder')} className="pl-9" />
                  </div>
                  <Select value={roleFilter} onValueChange={value => setRoleFilter(value as 'all' | ProjectMemberRole)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('membersPage.filterByRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      {roleFilterOptions.map(option => (
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
                  <AlertTitle>{t('membersPage.membersLoadFailedTitle')}</AlertTitle>
                  <AlertDescription>{t('membersPage.membersLoadFailedDescription')}</AlertDescription>
                </Alert>
              ) : (
                <div className="overflow-hidden rounded-md border border-border-subtle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('membersPage.user')}</TableHead>
                        <TableHead>{t('membersPage.inviteRole')}</TableHead>
                        <TableHead>{t('membersPage.joined')}</TableHead>
                        <TableHead>{t('membersPage.updated')}</TableHead>
                        <TableHead className="text-right">{t('membersPage.inviteActions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map(member => {
                        const isCurrentUser = currentUserId !== undefined && member.user_id === currentUserId;
                        const canEdit = canEditProjectMember(member, currentRole, currentUserId);
                        const canRemove = canRemoveProjectMember(member, currentRole, currentUserId);
                        const rowActionItems: ActionMenuItem[] = [
                          {
                            key: `edit-${member.user_id}`,
                            label: t('membersPage.editRole'),
                            icon: Pencil,
                            disabled: !canEdit,
                            onSelect: () => handleOpenEditDialog(member),
                          },
                          {
                            key: `delete-${member.user_id}`,
                            label: t('membersPage.remove'),
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
                                    {isCurrentUser ? <Badge variant="outline">{t('membersPage.you')}</Badge> : null}
                                    {member.role === 'owner' ? (
                                      <Badge variant="outline" className="gap-1">
                                        <Crown className="h-3 w-3" />
                                        {t('roles.owner')}
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
                                {member.role === 'owner'
                                  ? t('roles.owner')
                                  : member.role === 'admin'
                                    ? t('roles.admin')
                                    : member.role === 'write'
                                      ? t('roles.write')
                                      : t('roles.read')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {member.joined_at || member.created_at
                                ? formatDate(member.joined_at || member.created_at || '', 'YYYY-MM-DD HH:mm')
                                : '-'}
                            </TableCell>
                            <TableCell>{member.updated_at ? formatDate(member.updated_at, 'YYYY-MM-DD HH:mm') : '-'}</TableCell>
                            <TableCell className="text-right">
                              {!canManageMembers ? (
                                <span className="text-sm text-muted-foreground">{t('membersPage.adminRequired')}</span>
                              ) : canEdit || canRemove ? (
                                <ActionMenu items={rowActionItems} ariaLabel={i18n.common('openActions')} />
                              ) : (
                                <span className="text-sm text-muted-foreground">{t('membersPage.protected')}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            {t('membersPage.noMembersMatch')}
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
        open={isAddDialogOpen}
        onOpenChange={open => {
          setIsAddDialogOpen(open);
          if (!open) resetAddDialog();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('membersPage.addMemberDialogTitle')}</DialogTitle>
            <DialogDescription>{t('membersPage.addMemberDialogDescription')}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-5">
              {addDialogError ? (
                <Alert variant="destructive">
                  <AlertTitle>{t('membersPage.addMemberDialogErrorTitle')}</AlertTitle>
                  <AlertDescription>{addDialogError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="member-search">{t('membersPage.findUser')}</Label>
                <Input
                  id="member-search"
                  value={candidateQuery}
                  onChange={event => {
                    setCandidateQuery(event.target.value);
                    setAddDialogError(null);
                  }}
                  placeholder={t('membersPage.searchUserPlaceholder')}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t('membersPage.matchingUsers')}</Label>
                  <span className="text-sm text-muted-foreground">
                    {userSearchQuery.isFetching
                      ? t('membersPage.searching')
                      : t('membersPage.availableCount', { count: candidateResults.length })}
                  </span>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border-subtle bg-bg-canvas p-3">
                  {deferredCandidateQuery.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('membersPage.startTyping')}</p>
                  ) : userSearchQuery.isFetching ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-md bg-bg-soft" />
                      ))}
                    </div>
                  ) : candidateResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('membersPage.noEligibleUsers')}</p>
                  ) : (
                    candidateResults.map(candidate => {
                      const isSelected = String(selectedCandidate?.id) === String(candidate.id);
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-md border border-border-subtle bg-bg-canvas px-3 py-3 text-left transition-colors hover:bg-bg-subtle',
                            isSelected && 'bg-bg-surface'
                          )}
                          onClick={() => {
                            setSelectedCandidate(candidate);
                            setAddDialogError(null);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{candidate.username}</div>
                            <div className="truncate text-sm text-muted-foreground">{candidate.email}</div>
                          </div>
                          {isSelected ? <Badge>{t('membersPage.selected')}</Badge> : <Badge variant="outline">{t('membersPage.select')}</Badge>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-role">{t('membersPage.inviteRole')}</Label>
                <Select value={newMemberRole} onValueChange={value => setNewMemberRole(value as AssignableProjectMemberRole)}>
                  <SelectTrigger id="member-role">
                    <SelectValue placeholder={t('membersPage.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ASSIGNABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {role === 'admin' ? t('roles.admin') : role === 'write' ? t('roles.write') : t('roles.read')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCandidate ? (
                <div className="rounded-md border border-border-subtle bg-bg-soft p-4">
                  <div className="text-sm font-medium">{t('membersPage.selectedUser')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedCandidate.username} · {selectedCandidate.email}
                  </div>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {i18n.common('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleAddMember();
              }}
              disabled={addMemberMutation.isPending || !canManageMembers}
            >
              <UserPlus className="h-4 w-4" />
              {t('membersPage.addMember')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingMember)} onOpenChange={open => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('membersPage.editMemberDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('membersPage.editMemberDialogDescription', {
                username: editingMember?.username ?? editingMember?.email ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="rounded-md border border-border-subtle bg-bg-soft p-4">
                <div className="font-medium">{editingMember?.username}</div>
                <div className="text-sm text-muted-foreground">{editingMember?.email}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editing-role">{t('membersPage.inviteRole')}</Label>
                <Select value={editingRole} onValueChange={value => setEditingRole(value as AssignableProjectMemberRole)}>
                  <SelectTrigger id="editing-role">
                    <SelectValue placeholder={t('membersPage.selectRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ASSIGNABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {role === 'admin' ? t('roles.admin') : role === 'write' ? t('roles.write') : t('roles.read')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
              {i18n.common('cancel')}
            </Button>
            <Button type="button" onClick={() => void handleUpdateMember()} disabled={updateMemberMutation.isPending}>
              <Pencil className="h-4 w-4" />
              {t('membersPage.saveRole')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('membersPage.removeMemberDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('membersPage.removeMemberDialogDescription', {
                username: deleteTarget?.username ?? deleteTarget?.email ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-md border border-border-subtle bg-bg-soft p-4">
              <div className="font-medium">{deleteTarget?.username}</div>
              <div className="text-sm text-muted-foreground">{deleteTarget?.email}</div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {i18n.common('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteMember()} disabled={deleteMemberMutation.isPending}>
              <Trash2 className="h-4 w-4" />
              {t('membersPage.remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
