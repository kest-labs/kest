'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberKeys } from '@/hooks/use-members';
import { workspaceKeys } from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import { workspaceInvitationService } from '@/services/workspace-invitation';
import type { CreateWorkspaceInvitationRequest } from '@/types/workspace-invitation';

export const workspaceInvitationKeys = {
  all: ['workspace-invitations'] as const,
  workspace: (workspaceId: number | string) =>
    [...workspaceInvitationKeys.all, 'workspace', workspaceId] as const,
  list: (workspaceId: number | string) =>
    [...workspaceInvitationKeys.workspace(workspaceId), 'list'] as const,
  received: () => [...workspaceInvitationKeys.all, 'received'] as const,
  details: () => [...workspaceInvitationKeys.all, 'detail'] as const,
  detail: (slug: string) => [...workspaceInvitationKeys.details(), slug] as const,
};

export function useWorkspaceInvitations(workspaceId?: number | string, enabled = true) {
  return useQuery({
    queryKey: workspaceInvitationKeys.list(workspaceId ?? 'unknown'),
    queryFn: () => workspaceInvitationService.list(workspaceId as number | string),
    enabled: enabled && workspaceId !== undefined && workspaceId !== null && workspaceId !== '',
  });
}

export function useCreateWorkspaceInvitation(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateWorkspaceInvitationRequest) =>
      workspaceInvitationService.create(workspaceId, data),
    onSuccess: (invitation, variables) => {
      queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.workspace(workspaceId) });
      queryClient.setQueryData(workspaceInvitationKeys.detail(invitation.slug), invitation);
      toast.success(
        variables.invited_user_id
          ? t.workspace('toasts.memberInvitationSent')
          : t.workspace('toasts.inviteLinkGenerated')
      );
    },
  });
}

export function useDeleteWorkspaceInvitation(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (invitationId: number | string) =>
      workspaceInvitationService.revoke(workspaceId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.workspace(workspaceId) });
      toast.success(t.workspace('toasts.inviteLinkRevoked'));
    },
  });
}

export function useWorkspaceInvitationDetail(slug?: string) {
  return useQuery({
    queryKey: workspaceInvitationKeys.detail(slug ?? 'unknown'),
    queryFn: () => workspaceInvitationService.getDetail(slug as string),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function useMyWorkspaceInvitations() {
  return useQuery({
    queryKey: workspaceInvitationKeys.received(),
    queryFn: () => workspaceInvitationService.listReceived(),
  });
}

export function useAcceptWorkspaceInvitation(slug?: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (nextSlug?: string) =>
      workspaceInvitationService.accept(nextSlug ?? (slug as string)),
    onSuccess: (result, resolvedSlug) => {
      const targetSlug = resolvedSlug ?? slug;
      if (targetSlug) {
        queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.detail(targetSlug) });
      }
      queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.received() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.workspaceStats(result.workspace_id) });
      queryClient.invalidateQueries({ queryKey: memberKeys.workspace(result.workspace_id) });
      toast.success(t.workspace('toasts.invitationAccepted'));
    },
  });
}

export function useRejectWorkspaceInvitation(slug?: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (nextSlug?: string) =>
      workspaceInvitationService.reject(nextSlug ?? (slug as string)),
    onSuccess: (_result, resolvedSlug) => {
      const targetSlug = resolvedSlug ?? slug;
      if (targetSlug) {
        queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.detail(targetSlug) });
      }
      queryClient.invalidateQueries({ queryKey: workspaceInvitationKeys.received() });
      toast.success(t.workspace('toasts.invitationRejected'));
    },
  });
}
