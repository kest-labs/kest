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
  project: (projectId: number | string) =>
    [...projectInvitationKeys.all, 'project', projectId] as const,
  list: (projectId: number | string) =>
    [...projectInvitationKeys.project(projectId), 'list'] as const,
  received: () => [...projectInvitationKeys.all, 'received'] as const,
  details: () => [...projectInvitationKeys.all, 'detail'] as const,
  detail: (slug: string) => [...projectInvitationKeys.details(), slug] as const,
};

export function useProjectInvitations(projectId?: number | string, enabled = true) {
  return useQuery({
    queryKey: projectInvitationKeys.list(projectId ?? 'unknown'),
    queryFn: () => projectInvitationService.list(projectId as number | string),
    enabled: enabled && projectId !== undefined && projectId !== null && projectId !== '',
  });
}

export function useCreateProjectInvitation(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateProjectInvitationRequest) =>
      projectInvitationService.create(projectId, data),
    onSuccess: (invitation, variables) => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.project(projectId) });
      queryClient.setQueryData(projectInvitationKeys.detail(invitation.slug), invitation);
      toast.success(
        variables.invited_user_id
          ? t.project('toasts.memberInvitationSent')
          : t.project('toasts.inviteLinkGenerated')
      );
    },
  });
}

export function useDeleteProjectInvitation(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (invitationId: number | string) =>
      projectInvitationService.revoke(projectId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.project(projectId) });
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
      queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(result.project_id) });
      queryClient.invalidateQueries({ queryKey: memberKeys.project(result.project_id) });
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
