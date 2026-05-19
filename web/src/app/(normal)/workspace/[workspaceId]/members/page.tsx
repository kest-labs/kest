import { ProjectMemberManagementPage } from '@/components/features/project/project-member-management-page';

interface WorkspaceMembersPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// 项目成员管理页面入口。
// 作用：读取动态项目 ID，并挂载项目成员管理界面。
export default async function WorkspaceMembersPage({
  params,
}: WorkspaceMembersPageProps) {
  const { workspaceId } = await params;
  return <ProjectMemberManagementPage projectId={workspaceId} />;
}
