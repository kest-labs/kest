import { buildWorkspaceDashboardRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from '../_legacy/redirect';

interface LegacyProjectMembersPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectMembersPage({
  params,
}: LegacyProjectMembersPageProps) {
  await params;
  redirectLegacyProjectRoute(buildWorkspaceDashboardRoute());
}
