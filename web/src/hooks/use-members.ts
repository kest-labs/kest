'use client';

import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectKeys } from '@/hooks/use-projects';
import { useT } from '@/i18n/client';
import { memberService } from '@/services/member';
import { useCurrentUser } from '@/store/auth-store';
import type { AddProjectMemberRequest, UpdateProjectMemberRequest } from '@/types/member';

// Members 域的 React Query key。
// 作用：统一管理项目成员列表和当前用户成员角色缓存。
export const memberKeys = {
  all: ['members'] as const,
  project: (projectId: number | string) => [...memberKeys.all, 'workspace', projectId] as const,
  list: (projectId: number | string) => [...memberKeys.project(projectId), 'list'] as const,
  role: (projectId: number | string) => [...memberKeys.project(projectId), 'me'] as const,
};

// 项目成员列表查询。
// 作用：拉取指定项目下全部成员记录，供成员管理页渲染和本地过滤复用。
export function useProjectMembers(projectId?: number | string) {
  return useQuery({
    queryKey: memberKeys.list(projectId ?? 'unknown'),
    queryFn: () => memberService.list(projectId as number | string),
    enabled: projectId !== undefined && projectId !== null && projectId !== '',
  });
}

// 当前用户在项目中的成员角色查询。
// 作用：统一为项目工作区各页面提供 read/write/admin/owner 权限判断依据。
export function useProjectMemberRole(projectId?: number | string) {
  const currentUser = useCurrentUser();

  return useQuery({
    queryKey: memberKeys.role(projectId ?? 'unknown'),
    queryFn: () => memberService.getMyRole(projectId as number | string, currentUser?.id),
    enabled: projectId !== undefined && projectId !== null && projectId !== '',
    staleTime: 60_000,
  });
}

const invalidateMemberProjectData = (
  queryClient: QueryClient,
  projectId: number | string
) => {
  queryClient.invalidateQueries({ queryKey: memberKeys.project(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.projectStats(projectId) });
};

// 更新成员角色 mutation。
// 作用：角色更新后保持成员列表和项目统计同步。
export function useUpdateProjectMember(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: number | string;
      data: UpdateProjectMemberRequest;
    }) => memberService.update(projectId, userId, data),
    onSuccess: () => {
      invalidateMemberProjectData(queryClient, projectId);
      toast.success(t.project('toasts.memberRoleUpdated'));
    },
  });
}

// 删除成员 mutation。
// 作用：成员移除后刷新成员列表并同步项目统计数据。
export function useDeleteProjectMember(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (userId: number | string) => memberService.delete(projectId, userId),
    onSuccess: () => {
      invalidateMemberProjectData(queryClient, projectId);
      toast.success(t.project('toasts.memberRemoved'));
    },
  });
}

export function useMembers(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: AddProjectMemberRequest) => memberService.create(projectId, data),
    onSuccess: () => {
      invalidateMemberProjectData(queryClient, projectId);
      toast.success(t.project('toasts.memberInvitationSent'));
    },
  });
}
