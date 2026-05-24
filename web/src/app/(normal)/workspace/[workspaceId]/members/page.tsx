import { WorkspaceMemberManagementPage } from '@/components/features/workspace/workspace-member-management-page';

interface WorkspaceMembersPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// 工作区成员管理页面入口。
// 作用：读取动态工作区 ID，并挂载工作区成员管理界面。
export default async function WorkspaceMembersPage({
  params,
}: WorkspaceMembersPageProps) {
  const { workspaceId } = await params;
  return <WorkspaceMemberManagementPage workspaceId={workspaceId} />;
}
