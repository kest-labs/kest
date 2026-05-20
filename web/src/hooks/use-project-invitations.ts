'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberKeys } from '@/hooks/use-members';
import { projectKeys } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import { projectInvitationService } from '@/services/project-invitation';
import type { CreateProjectInvitationRequest } from '@/types/project-invitation';

export const projectInvitationKeys = {
  all: ['project-invitations'] as const,
  workspace: (workspaceId: number | string) =>
    [...projectInvitationKeys.all, 'workspace', workspaceId] as const,
  list: (workspaceId: number | string) =>
    [...projectInvitationKeys.workspace(workspaceId), 'list'] as const,
  received: () => [...projectInvitationKeys.all, 'received'] as const,
  details: () => [...projectInvitationKeys.all, 'detail'] as const,
  detail: (slug: string) => [...projectInvitationKeys.details(), slug] as const,
};

export function useProjectInvitations(workspaceId?: number | string, enabled = true) {
  return useQuery({
    queryKey: projectInvitationKeys.list(workspaceId ?? 'unknown'),
    queryFn: () => projectInvitationService.list(workspaceId as number | string),
    enabled: enabled && workspaceId !== undefined && workspaceId !== null && workspaceId !== '',
  });
}

export function useCreateProjectInvitation(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateProjectInvitationRequest) =>
      projectInvitationService.create(workspaceId, data),
    onSuccess: (invitation, variables) => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.workspace(workspaceId) });
      queryClient.setQueryData(projectInvitationKeys.detail(invitation.slug), invitation);
      toast.success(
        variables.invited_user_id
          ? t.project('toasts.memberInvitationSent')
          : t.project('toasts.inviteLinkGenerated')
      );
    },
  });
}

export function useDeleteProjectInvitation(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (invitationId: number | string) =>
      projectInvitationService.revoke(workspaceId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.workspace(workspaceId) });
      toast.success(t.project('toasts.inviteLinkRevoked'));
    },
  });
}

export function useProjectInvitationDetail(slug?: string) {
  return useQuery({
    queryKey: projectInvitationKeys.detail(slug ?? 'unknown'),
    queryFn: () => projectInvitationService.getDetail(slug as string),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function useMyProjectInvitations() {
  return useQuery({
    queryKey: projectInvitationKeys.received(),
    queryFn: () => projectInvitationService.listReceived(),
  });
}

export function useAcceptProjectInvitation(slug?: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (nextSlug?: string) =>
      projectInvitationService.accept(nextSlug ?? (slug as string)),
    onSuccess: (result, resolvedSlug) => {
      const targetSlug = resolvedSlug ?? slug;
      if (targetSlug) {
        queryClient.invalidateQueries({ queryKey: projectInvitationKeys.detail(targetSlug) });
      }
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.received() });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(result.workspace_id) });
      queryClient.invalidateQueries({ queryKey: memberKeys.project(result.workspace_id) });
      toast.success(t.project('toasts.invitationAccepted'));
    },
  });
}

export function useRejectProjectInvitation(slug?: string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (nextSlug?: string) =>
      projectInvitationService.reject(nextSlug ?? (slug as string)),
    onSuccess: (_result, resolvedSlug) => {
      const targetSlug = resolvedSlug ?? slug;
      if (targetSlug) {
        queryClient.invalidateQueries({ queryKey: projectInvitationKeys.detail(targetSlug) });
      }
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.received() });
      toast.success(t.project('toasts.invitationRejected'));
    },
  });
}
