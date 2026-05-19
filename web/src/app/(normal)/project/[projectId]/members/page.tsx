import { buildProjectMembersRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from '../_legacy/redirect';

interface LegacyProjectMembersPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectMembersPage({
  params,
}: LegacyProjectMembersPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectMembersRoute(projectId));
}
