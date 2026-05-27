import { WorkspaceAreaShell } from '@/components/features/workspace/workspace-area-shell';

// 工作区路由组布局。
// 作用：为 dashboard 和 workspace 提供统一的工作区顶栏，而不是继续复用旧的控制台侧栏。
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceAreaShell>{children}</WorkspaceAreaShell>;
}
