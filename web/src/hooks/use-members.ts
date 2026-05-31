'use client';

import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workspaceKeys } from '@/hooks/use-workspaces';
import { useT } from '@/i18n/client';
import { memberService } from '@/services/member';
import type { UpdateWorkspaceMemberRequest } from '@/types/member';

interface MemberQueryOptions {
  enabled?: boolean;
}

// Members 域的 React Query key。
// 作用：统一管理工作区成员列表和当前用户成员角色缓存。
export const memberKeys = {
  all: ['members'] as const,
  workspace: (workspaceId: number | string) =>
    [...memberKeys.all, 'workspace', workspaceId] as const,
  list: (workspaceId: number | string) => [...memberKeys.workspace(workspaceId), 'list'] as const,
  role: (workspaceId: number | string) => [...memberKeys.workspace(workspaceId), 'me'] as const,
};

// 工作区成员列表查询。
// 作用：拉取指定工作区下全部成员记录，供成员管理页渲染和本地过滤复用。
export function useWorkspaceMembers(
  workspaceId?: number | string,
  options: MemberQueryOptions = {}
) {
  const isEnabled = options.enabled ?? true;

  return useQuery({
    queryKey: memberKeys.list(workspaceId ?? 'unknown'),
    queryFn: () => memberService.list(workspaceId as number | string),
    enabled: isEnabled && workspaceId !== undefined && workspaceId !== null && workspaceId !== '',
  });
}

// 当前用户在工作区中的成员角色查询。
// 作用：统一为工作区工作区各页面提供 read/write/admin/owner 权限判断依据。
export function useWorkspaceMemberRole(workspaceId?: number | string) {
  return useQuery({
    queryKey: memberKeys.role(workspaceId ?? 'unknown'),
    queryFn: () => memberService.getMyRole(workspaceId as number | string),
    enabled: workspaceId !== undefined && workspaceId !== null && workspaceId !== '',
    staleTime: 60_000,
  });
}

const invalidateMemberWorkspaceData = (queryClient: QueryClient, workspaceId: number | string) => {
  queryClient.invalidateQueries({ queryKey: memberKeys.workspace(workspaceId) });
  queryClient.invalidateQueries({ queryKey: workspaceKeys.workspaceStats(workspaceId) });
};

// 更新成员角色 mutation。
// 作用：角色更新后保持成员列表和工作区统计同步。
export function useUpdateWorkspaceMember(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: number | string;
      data: UpdateWorkspaceMemberRequest;
    }) => memberService.update(workspaceId, userId, data),
    onSuccess: () => {
      invalidateMemberWorkspaceData(queryClient, workspaceId);
      toast.success(t.workspace('toasts.memberRoleUpdated'));
    },
  });
}

// 删除成员 mutation。
// 作用：成员移除后刷新成员列表并同步工作区统计数据。
export function useDeleteWorkspaceMember(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (userId: number | string) => memberService.delete(workspaceId, userId),
    onSuccess: () => {
      invalidateMemberWorkspaceData(queryClient, workspaceId);
      toast.success(t.workspace('toasts.memberRemoved'));
    },
  });
}
