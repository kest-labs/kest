
import { AuthGuard } from '@/components/auth-guard';
import { ProjectOnboardingShell } from '@/components/features/project/project-onboarding-shell';

export default function NormalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {children}
      <ProjectOnboardingShell />
    </AuthGuard>
  );
}
