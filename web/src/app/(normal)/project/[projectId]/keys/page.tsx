import { buildProjectKeysRoute } from '@/constants/routes';
import { redirectLegacyProjectRoute } from '../_legacy/redirect';

interface LegacyProjectKeysPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function LegacyProjectKeysPage({ params }: LegacyProjectKeysPageProps) {
  const { projectId } = await params;
  redirectLegacyProjectRoute(buildProjectKeysRoute(projectId));
}
