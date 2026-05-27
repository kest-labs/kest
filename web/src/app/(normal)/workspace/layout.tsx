import { WorkspaceAreaShell } from '@/components/features/workspace/workspace-area-shell';

// 项目路由组布局。
// 作用：为 dashboard 和 workspace 提供统一的项目顶栏，而不是继续复用旧的控制台侧栏。
export default function WorkspaceLayoutRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceAreaShell>{children}</WorkspaceAreaShell>;
}
