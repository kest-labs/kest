import { ProjectDashboardPage } from '@/components/features/project/project-dashboard-page';

// `/project` 路由入口页。
// 作用：承载登录后的项目 dashboard，让用户先预览 project，再进入真正的工作区。
export default function ProjectPage() {
  return <ProjectDashboardPage />;
}
