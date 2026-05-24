
import { AuthGuard } from '@/components/auth-guard';
import { WorkspaceOnboardingShell } from '@/components/features/workspace/workspace-onboarding-shell';

export default function NormalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {children}
      <WorkspaceOnboardingShell />
    </AuthGuard>
  );
}
