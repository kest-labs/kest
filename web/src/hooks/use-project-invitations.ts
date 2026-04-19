'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { memberKeys } from '@/hooks/use-members';
import { projectKeys } from '@/hooks/use-projects';
import { projectInvitationService } from '@/services/project-invitation';
import type { CreateProjectInvitationRequest } from '@/types/project-invitation';

export const projectInvitationKeys = {
  all: ['project-invitations'] as const,
  project: (projectId: number | string) =>
    [...projectInvitationKeys.all, 'project', projectId] as const,
  list: (projectId: number | string) =>
    [...projectInvitationKeys.project(projectId), 'list'] as const,
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

  return useMutation({
    mutationFn: (data: CreateProjectInvitationRequest) =>
      projectInvitationService.create(projectId, data),
    onSuccess: invitation => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.project(projectId) });
      queryClient.setQueryData(projectInvitationKeys.detail(invitation.slug), invitation);
      toast.success('Invite link generated');
    },
  });
}

export function useDeleteProjectInvitation(projectId: number | string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: number | string) =>
      projectInvitationService.revoke(projectId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.project(projectId) });
      toast.success('Invite link revoked');
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

export function useAcceptProjectInvitation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectInvitationService.accept(slug),
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.detail(slug) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(result.project_id) });
      queryClient.invalidateQueries({ queryKey: memberKeys.project(result.project_id) });
      toast.success('Invitation accepted');
    },
  });
}

export function useRejectProjectInvitation(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => projectInvitationService.reject(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectInvitationKeys.detail(slug) });
      toast.success('Invitation rejected');
    },
  });
}
