import { WorkspaceDashboardPage } from '@/components/features/workspace/workspace-dashboard-page';

// `/workspace` 路由入口页。
// 作用：承载登录后的工作区 dashboard，让用户先预览 workspace，再进入真正的工作区。
export default function WorkspacePage() {
  return <WorkspaceDashboardPage />;
}
